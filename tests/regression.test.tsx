import { scanCatalog } from '../src/services/qdn/catalogService';
import { discoverResources } from '../src/services/qdn/resourceDiscovery';
import {
  readQdnDocument,
  cachedDocuments,
} from '../src/services/cache/qdnDocumentCache';
import { ensureCompleteCatalog } from '../src/features/podcasts/hooks/usePodcastCrud';
import {
  matchesPodcastFilters,
  catalogTaxonomy,
} from '../src/features/podcasts/utils/catalogFilters';
import { useEpisodeEngagement } from '../src/features/podcasts/hooks/useEpisodeEngagement';
import StatisticsStatus from '../src/features/podcasts/components/StatisticsStatus';
import App from '../src/App';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  requestQortal,
  clearQortalCache,
} from '../src/services/qortal/qortalClient';
import {
  searchPodcastPage,
  updatePodcast,
  deletePodcast,
  publishPodcast,
} from '../src/services/qdn/podcastQdnService';
import {
  fetchAllFeedback,
  fetchUserFeedback,
} from '../src/services/engagement/episodeEngagementService';
import { publishResourceOnce } from '../src/services/qdn/publicationJournal';
import { usePodcastCrud } from '../src/features/podcasts/hooks/usePodcastCrud';
import SendTipModal from '../src/features/podcasts/components/SendTipModal';
import {
  GlobalPlaybackProvider,
  useGlobalPlayback,
} from '../src/features/podcasts/context/GlobalPlaybackContext';
import { EpisodeComposerProvider } from '../src/features/podcasts/context/EpisodeComposerContext';
import { usePodcastSocial } from '../src/features/podcasts/hooks/usePodcastSocial';
const pause = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const fixture = (id = 'one', owner = 'Tester') => ({
  version: 1,
  episodeId: id,
  title: 'Old title',
  description: 'Description',
  tags: [],
  categories: [],
  createdAt: 1,
  updatedAt: 1,
  status: 'active',
  audio: {
    service: 'AUDIO',
    name: owner,
    identifier: `audio-${id}`,
    filename: 'test.ogg',
  },
  thumbnail: null,
});
const episode = (id = 'one', owner = 'Tester') => ({
  ...fixture(id, owner),
  ownerName: owner,
  metadataIdentifier: `qpodcasts-episode-${id}-meta`,
});
const setBridge = (fn) => {
  clearQortalCache();
  globalThis.qortalRequestWithTimeout = undefined;
  globalThis.qortalRequest = fn;
};
const mount = async (element) => {
  const node = document.createElement('div');
  document.body.append(node);
  const root = createRoot(node);
  await act(async () => {
    root.render(element);
    await pause();
  });
  return {
    node,
    root,
    close: async () => {
      await act(async () => root.unmount());
      node.remove();
    },
  };
};

test('request parser accepts informational success and rejects numeric errors and false', async () => {
  setBridge(async () => ({ success: true, message: 'OK' }));
  assert.equal((await requestQortal({ action: 'TEST' })).message, 'OK');
  setBridge(async () => ({ error: 401 }));
  await assert.rejects(requestQortal({ action: 'TEST' }));
  setBridge(async () => false);
  await assert.rejects(requestQortal({ action: 'TEST' }));
});
test('custom timeout reaches the Core bridge', async () => {
  let timeout;
  setBridge(async () => {
    throw Error('wrong bridge');
  });
  globalThis.qortalRequestWithTimeout = async (_, ms) => {
    timeout = ms;
    return true;
  };
  await requestQortal({ action: 'SEND_COIN' }, { timeoutMs: 23456 });
  assert.equal(timeout, 23456);
  globalThis.qortalRequestWithTimeout = undefined;
});
test('background reads use two slots and do not hold an interactive audio request', async () => {
  let active = 0,
    peak = 0;
  const releases = [];
  let audio = false;
  setBridge((p) => {
    if (p.action === 'GET_QDN_RESOURCE_URL') {
      audio = true;
      return Promise.resolve('/audio');
    }
    active++;
    peak = Math.max(peak, active);
    return new Promise((resolve) =>
      releases.push(() => {
        active--;
        resolve([]);
      })
    );
  });
  const requests = Array.from({ length: 10 }, (_, i) =>
    requestQortal(
      { action: 'FETCH_QDN_RESOURCE', identifier: `queue-${i}` },
      { priority: 'background' }
    )
  );
  assert.equal(peak, 2);
  await requestQortal({ action: 'GET_QDN_RESOURCE_URL' });
  assert.equal(audio, true);
  while (releases.length) {
    releases.shift()();
    await pause();
  }
  await Promise.all(requests);
  assert.equal(peak, 2);
});
test('identical in-flight reads and fresh results are shared', async () => {
  let calls = 0;
  setBridge(async () => {
    calls++;
    await pause(2);
    return ['cached'];
  });
  const p = { action: 'GET_ACCOUNT_NAMES', address: 'cache-test' };
  await Promise.all([
    requestQortal(p, { cacheMs: 10000 }),
    requestQortal(p, { cacheMs: 10000 }),
  ]);
  await requestQortal(p, { cacheMs: 10000 });
  assert.equal(calls, 1);
});
test('episode page emits fast metadata before a slow resource completes', async () => {
  let release;
  const emitted = [];
  let fastReady;
  const fast = new Promise((resolve) => {
    fastReady = resolve;
  });
  setBridge(async (p) => {
    if (p.action === 'SEARCH_QDN_RESOURCES')
      return ['fast', 'slow'].map((id) => ({
        name: 'Tester',
        identifier: `qpodcasts-episode-${id}-meta`,
      }));
    if (p.identifier.includes('slow'))
      await new Promise((resolve) => {
        release = resolve;
      });
    return fixture(p.identifier.includes('slow') ? 'slow' : 'fast');
  });
  const request = searchPodcastPage({
    onEpisode: (item) => {
      emitted.push(item.episodeId);
      if (item.episodeId === 'fast') fastReady();
    },
  });
  await fast;
  while (!release) await pause();
  assert.deepEqual(emitted, ['fast']);
  release();
  await request;
  assert.deepEqual(emitted, ['fast', 'slow']);
});
test('server pagination scopes owner and advances raw resource offsets', async () => {
  let search;
  setBridge(async (p) => {
    search = p;
    return [];
  });
  const page = await searchPodcastPage({
    limit: 20,
    offset: 60,
    ownerName: 'Publisher',
  });
  assert.equal(search.name, 'Publisher');
  assert.equal(search.exactMatchNames, true);
  assert.equal(search.offset, 60);
  assert.equal(page.hasMore, false);
});
test('feedback uses bounded concurrency, all pages, publisher checks and latest legacy deduplication', async () => {
  let active = 0,
    peak = 0,
    searches = 0;
  const entries = Array.from({ length: 101 }, (_, i) => ({
    name: `User${i}`,
    identifier: `qpodcasts-feedback-episode${i}`,
  }));
  setBridge(async (p) => {
    if (p.action === 'SEARCH_QDN_RESOURCES') {
      searches++;
      return entries.slice(p.offset, p.offset + 100);
    }
    active++;
    peak = Math.max(peak, active);
    await pause(1);
    active--;
    return {
      version: 1,
      episodeId: p.identifier.replace('qpodcasts-feedback-', ''),
      userName: p.name,
      like: true,
      tipCount: 0,
      tipTotal: 0,
      updatedAt: 1,
    };
  });
  assert.equal((await fetchAllFeedback()).length, 101);
  assert.equal(searches, 3);
  assert.ok(peak <= 2);
  setBridge(async (p) =>
    p.action === 'SEARCH_QDN_RESOURCES'
      ? [
          { name: 'Alice', identifier: 'qpodcasts-feedback-one' },
          { name: 'Alice', identifier: 'qpodcasts-feedback-one-alice' },
          { name: 'Bob', identifier: 'qpodcasts-feedback-two' },
        ]
      : {
          version: 1,
          episodeId: p.name === 'Bob' ? 'two' : 'one',
          userName: 'Alice',
          like: p.identifier.endsWith('alice'),
          tipCount: 0,
          tipTotal: 0,
          updatedAt: p.identifier.endsWith('alice') ? 2 : 1,
        }
  );
  const result = await fetchAllFeedback();
  assert.equal(result.length, 1);
  assert.equal(result[0].like, true);
});
test('missing feedback checks existence without two slow missing-resource fetches', async () => {
  const actions = [];
  setBridge(async (p) => {
    actions.push(p.action);
    return [];
  });
  assert.equal(await fetchUserFeedback('Tester', 'missing'), null);
  assert.deepEqual(actions, ['SEARCH_QDN_RESOURCES']);
});
test('stale update/delete read-back is pending, never reported verified or republished', async () => {
  let writes = 0;
  const progress = [];
  // Avoid real retry delays while retaining verification iterations.
  const timer = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...args) =>
    timer(fn, ms === 1500 ? 0 : ms, ...args);
  setBridge(async (p) => {
    if (p.action === 'PUBLISH_QDN_RESOURCE') {
      writes++;
      return true;
    }
    return fixture('verify');
  });
  try {
    await updatePodcast(
      {
        episode: episode('verify'),
        title: 'New title',
        description: 'New',
        tags: [],
        categories: [],
      },
      { onProgress: (p) => progress.push(p.message) }
    );
    await deletePodcast(episode('verify'), {
      onProgress: (p) => progress.push(p.message),
    });
  } finally {
    globalThis.setTimeout = timer;
  }
  assert.equal(writes, 2);
  assert.equal(progress.filter((p) => p.includes('pending')).length, 2);
});
test('uncertain publication is not repeated and a confirmed audio stage resumes once', async () => {
  let writes = 0;
  setBridge(async (p) => {
    if (p.action === 'PUBLISH_QDN_RESOURCE') writes++;
    throw new Error('network disconnected');
  });
  const payload = {
    action: 'PUBLISH_QDN_RESOURCE',
    service: 'PODCAST',
    name: 'Tester',
    identifier: 'uncertain',
    base64: 'e30=',
  };
  await assert.rejects(publishResourceOnce(payload));
  await assert.rejects(publishResourceOnce(payload));
  assert.equal(writes, 1);
  const audio = new File(['data'], 'podcast.ogg');
  const input = {
    ownerName: 'Tester',
    title: 'Resume',
    description: '',
    tags: [],
    categories: [],
    audioFile: audio,
  };
  let audioWrites = 0,
    metadataWrites = 0;
  setBridge(async (p) => {
    if (p.action === 'PUBLISH_QDN_RESOURCE') {
      if (p.service === 'AUDIO') audioWrites++;
      else {
        metadataWrites++;
        throw Error('User declined');
      }
      return true;
    }
    return {};
  });
  await assert.rejects(publishPodcast(input));
  await assert.rejects(publishPodcast(input));
  assert.equal(audioWrites, 1);
  assert.equal(metadataWrites, 2);
});
test('feed survives unmount/remount without reloading its resources', async () => {
  let searches = 0;
  let value;
  setBridge(async (p) => {
    if (p.action === 'SEARCH_QDN_RESOURCES') {
      searches++;
      return [
        { name: 'CacheOwner', identifier: 'qpodcasts-episode-cached-meta' },
      ];
    }
    return fixture('cached', 'CacheOwner');
  });
  function Probe() {
    value = usePodcastCrud('CacheOwner');
    return <p>{value.episodes.length}</p>;
  }
  const first = await mount(<Probe />);
  await act(async () => {
    await pause(10);
  });
  assert.equal(value.episodes.length, 1);
  await first.close();
  const second = await mount(<Probe />);
  assert.equal(value.episodes.length, 1);
  assert.equal(searches, 1);
  await second.close();
});
test('closed playlists perform no privileged list reads', async () => {
  let calls = 0;
  setBridge(async () => {
    calls++;
    return [];
  });
  function Probe() {
    usePodcastSocial('Tester');
    return null;
  }
  const view = await mount(
    <EpisodeComposerProvider>
      <Probe />
    </EpisodeComposerProvider>
  );
  assert.equal(calls, 0);
  await view.close();
});
test('successful payment stays successful if feedback publication fails', async () => {
  let payments = 0;
  setBridge(async (p) => {
    if (p.action === 'GET_NAME_DATA') return { owner: 'Qowner' };
    if (p.action === 'SEND_COIN') {
      payments++;
      return { signature: 'sent' };
    }
    return 10;
  });
  const view = await mount(
    <SendTipModal
      isOpen
      publisherName="Publisher"
      onSent={async () => {
        throw Error('stats unavailable');
      }}
      onClose={() => {}}
    />
  );
  const input = view.node.querySelector('input[type="number"]');
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )!.set!;
  await act(async () => {
    setter.call(input, '1');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await act(async () => {
    view.node
      .querySelector('form')!
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      );
    await pause(10);
  });
  assert.equal(payments, 1);
  assert.match(view.node.textContent!, /Tip sent to Publisher/);
  assert.match(view.node.textContent!, /statistics could not be updated/);
  assert.equal(
    view.node.querySelector('button[type="submit"]')!.disabled,
    true
  );
  await view.close();
});
test('closing the player invalidates a late URL response', async () => {
  let controls, release;
  setBridge((payload) =>
    payload.action === 'GET_QDN_RESOURCE_STATUS'
      ? Promise.resolve({ status: 'READY' })
      : new Promise((resolve) => {
          release = resolve;
        })
  );
  function Probe() {
    controls = useGlobalPlayback();
    return null;
  }
  const view = await mount(
    <GlobalPlaybackProvider>
      <Probe />
    </GlobalPlaybackProvider>
  );
  let pending;
  await act(async () => {
    pending = controls.playEpisode(episode('late'));
    await pause();
    controls.closePlayer();
  });
  await act(async () => {
    release('/late-audio');
    await pending;
  });
  assert.equal(controls.isPlayerOpen, false);
  assert.equal(controls.audioUrl, null);
  await view.close();
});

test('app navigates Home → Browse → Home using the shared feed, and publisher opens on Browse', async () => {
  let searches = 0;
  setBridge(async (p) => {
    if (p.action === 'GET_USER_ACCOUNT')
      return { address: 'Qtest', publicKey: 'pk' };
    if (p.action === 'GET_PRIMARY_NAME') return 'Tester';
    if (p.action === 'GET_ACCOUNT_NAMES') return [{ name: 'Tester' }];
    if (p.action === 'SEARCH_QDN_RESOURCES') {
      if (p.identifier === 'qpodcasts-feedback-') return [];
      searches++;
      return [
        { name: 'Tester', identifier: 'qpodcasts-episode-integration-meta' },
      ];
    }
    if (p.action === 'FETCH_QDN_RESOURCE') return fixture('integration');
    if (p.action === 'GET_QDN_RESOURCE_URL') return '/thumbnail';
    return [];
  });
  const view = await mount(<App />);
  await act(async () => {
    await pause(30);
  });
  const button = (label) =>
    [...view.node.querySelectorAll('button')].find(
      (item) => item.textContent === label
    );
  assert.match(view.node.textContent!, /Old title/);
  await act(async () => {
    await ensureCompleteCatalog();
  });
  const initialSearches = searches;
  await act(async () => {
    button('Browse all Episodes')!.click();
    await pause(20);
  });
  assert.match(view.node.textContent!, /Browse/);
  await act(async () => {
    button('Publish New Episode')!.click();
    await pause(20);
  });
  assert.ok(
    [...view.node.querySelectorAll('h3')].some(
      (item) => item.textContent === 'Publish new episode'
    )
  );
  await act(async () => {
    button('Close')!.click();
    await pause();
    button('Back to Home')!.click();
    await pause(20);
  });
  assert.match(view.node.textContent!, /Latest 20 Episodes/);
  assert.equal(searches, initialSearches);
  await view.close();
});

test('payment uncertainty survives another caller and never automatically resends', async () => {
  const { sendQort, acknowledgeUnknownTransfer } = await import(
    '../src/services/qortal/walletService'
  );
  let writes = 0;
  setBridge(async () => {
    writes++;
    throw Error('connection lost');
  });
  const input = {
    senderKey: 'Sender',
    recipient: 'UnknownRecipient',
    amount: 2,
  };
  await assert.rejects(sendQort(input));
  await assert.rejects(sendQort(input));
  assert.equal(writes, 1);
  acknowledgeUnknownTransfer(input);
  await assert.rejects(sendQort(input));
  assert.equal(writes, 2);
});

const resourceFor = (id: string, revision = 1000) => ({
  name: 'CatalogTester',
  identifier: `qpodcasts-episode-${id}-meta`,
  created: 100,
  updated: revision,
});
const scanFixture = (resources, body, onRead = () => {}) =>
  setBridge(async (p) => {
    if (p.action === 'SEARCH_QDN_RESOURCES')
      return p.limit === 1
        ? resources.slice(-1)
        : resources.slice(p.offset, p.offset + p.limit);
    if (p.action === 'FETCH_QDN_RESOURCE') {
      onRead(p);
      return body(p);
    }
    throw Error('Unexpected request');
  });
const scan = async () => {
  const episodes = [];
  let progress;
  await scanCatalog({
    onEpisode: (episode) => episodes.push(episode),
    onDeleted: () => {},
    onProgress: (value) => {
      progress = value;
    },
  });
  return { episodes, progress };
};

test('full catalog scans beyond 100 resources and finds text beyond Core index limits', async () => {
  const resources = Array.from({ length: 235 }, (_, i) =>
    resourceFor(`full-${i}`, 1000 + i)
  );
  scanFixture(resources, (p) => {
    const id = p.identifier.slice('qpodcasts-episode-'.length, -5);
    return {
      ...fixture(id, 'CatalogTester'),
      description:
        id === 'full-187' ? 'x'.repeat(600) + ' hidden-needle' : 'ordinary',
      tags: id === 'full-187' ? ['RareTag'] : [],
      categories: id === 'full-187' ? ['Remote Category'] : [],
    };
  });
  const result = await scan();
  assert.equal(result.episodes.length, 235);
  assert.equal(result.progress.processed, 235);
  assert.equal(result.progress.failed, 0);
  const matches = result.episodes.filter((episode) =>
    matchesPodcastFilters(episode, {
      query: 'hidden-needle',
      category: ' remote category ',
      tags: [' raretag '],
    })
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].episodeId, 'full-187');
});

test('catalog warm scan reuses unchanged documents and fetches only a changed revision', async () => {
  const resources = [resourceFor('warm-one', 20), resourceFor('warm-two', 20)];
  let reads = 0;
  scanFixture(
    resources,
    (p) =>
      fixture(
        p.identifier.slice('qpodcasts-episode-'.length, -5),
        'CatalogTester'
      ),
    () => reads++
  );
  await scan();
  assert.equal(reads, 2);
  await scan();
  assert.equal(reads, 2);
  resources[1] = { ...resources[1], updated: 21 };
  await scan();
  assert.equal(reads, 3);
});

test('resource discovery uses the node timestamp and detects non-advancing pagination', async () => {
  const resources = Array.from({ length: 100 }, (_, i) =>
    resourceFor(`repeated-${i}`)
  );
  let boundary;
  setBridge(async (p) => {
    if (p.limit === 1) return [{ ...resources[99], created: 7654321 }];
    boundary = p.before;
    return resources;
  });
  await assert.rejects(
    discoverResources('qpodcasts-episode-', () => {}),
    /did not advance/
  );
  assert.equal(boundary, 7654322);
});

test('an unavailable catalog document does not stop later resources or claim completeness', async () => {
  const resources = Array.from({ length: 110 }, (_, i) =>
    resourceFor(`partial-${i}`, 2000 + i)
  );
  scanFixture(resources, (p) => {
    if (p.identifier.includes('partial-4-meta')) throw Error('unavailable');
    return fixture(
      p.identifier.slice('qpodcasts-episode-'.length, -5),
      'CatalogTester'
    );
  });
  const result = await scan();
  assert.equal(result.episodes.length, 109);
  assert.equal(result.progress.failed, 1);
  assert.equal(result.progress.processed, 110);
  assert.ok(
    result.episodes.some((episode) => episode.episodeId === 'partial-109')
  );
});

test('persistent document cache survives a fresh module instance and invalidates by resource revision', async () => {
  const resource = resourceFor('persistent', 3000);
  let reads = 0;
  setBridge(async () => {
    reads++;
    return { title: 'Persisted' };
  });
  await readQdnDocument('episodes', resource);
  const cold = await import(
    new URL('./cache-reload.mjs', import.meta.url).href
  );
  assert.deepEqual(await cold.readQdnDocument('episodes', resource), {
    title: 'Persisted',
  });
  assert.equal(reads, 1);
  await cold.readQdnDocument('episodes', { ...resource, updated: 3001 });
  assert.equal(reads, 2);
});

test('document cache falls back to memory when IndexedDB is unavailable', async () => {
  const available = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  try {
    const cold = await import(
      new URL('./cache-reload.mjs?without-db', import.meta.url).href
    );
    let reads = 0;
    setBridge(async () => {
      reads++;
      return { ok: true };
    });
    const resource = resourceFor('memory-only', 4000);
    await cold.readQdnDocument('episodes', resource);
    await cold.readQdnDocument('episodes', resource);
    assert.equal(reads, 1);
  } finally {
    globalThis.indexedDB = available;
  }
});

test('a late older resource revision cannot replace a newer cached revision', async () => {
  let release;
  const resource = resourceFor('revision-race', 5000);
  let reads = 0;
  setBridge(async () => {
    reads++;
    if (reads === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return { version: reads === 1 ? 'old' : 'new' };
  });
  const older = readQdnDocument('episodes', resource);
  while (!release) await pause();
  await readQdnDocument('episodes', { ...resource, updated: 5001 });
  release();
  await older;
  await readQdnDocument('episodes', { ...resource, updated: 5001 });
  assert.equal(reads, 2);
  const entry = (await cachedDocuments('episodes')).find(
    (item) => item.resource.identifier === resource.identifier
  );
  assert.equal(entry!.resource.updated, 5001);
});

test('feedback warm sync reads only changed resources, keeps failed totals partial, and removes withdrawn records', async () => {
  let resources = [
    {
      name: 'WarmFeedback',
      identifier: 'qpodcasts-feedback-warm',
      created: 100,
      updated: 100,
    },
  ];
  let reads = 0;
  let fail = false;
  setBridge(async (p) => {
    if (p.action === 'SEARCH_QDN_RESOURCES')
      return p.limit === 1
        ? resources.slice(-1)
        : resources.slice(p.offset, p.offset + p.limit);
    reads++;
    if (fail) throw Error('temporarily unavailable');
    return {
      version: 1,
      episodeId: 'warm',
      userName: 'WarmFeedback',
      like: resources[0].updated === 100,
      tipCount: 0,
      tipTotal: 0,
      updatedAt: resources[0].updated,
    };
  });
  assert.equal((await fetchAllFeedback())[0].like, true);
  await fetchAllFeedback();
  assert.equal(reads, 1);
  resources = [{ ...resources[0], updated: 101 }];
  fail = true;
  let progress;
  assert.equal(
    (
      await fetchAllFeedback(undefined, (value) => {
        progress = value;
      })
    )[0].like,
    true
  );
  assert.equal(progress.failed, 1);
  fail = false;
  assert.equal((await fetchAllFeedback())[0].like, false);
  assert.equal(reads, 3);
  resources = [];
  assert.deepEqual(await fetchAllFeedback(), []);
  assert.equal((await cachedDocuments('feedback')).length, 0);
});

test('canonical and legacy feedback are deduplicated by chain revision rather than a forged payload timestamp', async () => {
  const resources = [
    {
      name: 'LegacyTester',
      identifier: 'qpodcasts-feedback-chain-legacytester',
      created: 1,
      updated: 1,
    },
    {
      name: 'LegacyTester',
      identifier: 'qpodcasts-feedback-chain',
      created: 2,
      updated: 2,
    },
  ];
  setBridge(async (p) =>
    p.action === 'SEARCH_QDN_RESOURCES'
      ? p.limit === 1
        ? resources.slice(-1)
        : resources
      : {
          version: 1,
          episodeId: 'chain',
          userName: 'LegacyTester',
          like: p.identifier === 'qpodcasts-feedback-chain',
          tipCount: 0,
          tipTotal: 0,
          updatedAt: p.identifier.endsWith('legacytester')
            ? Number.MAX_SAFE_INTEGER
            : 2,
        }
  );
  const result = await fetchAllFeedback();
  assert.equal(result.length, 1);
  assert.equal(result[0].like, true);
});

test('statistics UI reports unavailable feedback as incomplete instead of verified zero', async () => {
  const resources = [
    {
      name: 'FailedStats',
      identifier: 'qpodcasts-feedback-failed',
      created: 1,
      updated: 1,
    },
  ];
  setBridge(async (p) => {
    if (p.action === 'SEARCH_QDN_RESOURCES') return resources;
    throw Error('missing resource');
  });
  let state;
  function Probe() {
    state = useEpisodeEngagement(null);
    return <StatisticsStatus />;
  }
  const view = await mount(<Probe />);
  await act(async () => {
    await state.refresh();
  });
  assert.equal(state.isComplete, false);
  assert.equal(state.failed, 1);
  assert.match(view.node.textContent!, /Statistics are incomplete/);
  assert.doesNotMatch(view.node.textContent!, /Statistics checked/);
  await view.close();
});

test('taxonomy treats repeated/case-varied tags as one category count per episode', () => {
  const first = {
    ...episode('taxonomy-one'),
    tags: [' Foo ', 'foo'],
    categories: [' Garden ', 'garden'],
  };
  const second = {
    ...episode('taxonomy-two'),
    tags: ['FOO'],
    categories: ['GARDEN'],
  };
  const taxonomy = catalogTaxonomy([first, second]);
  assert.equal(taxonomy.tags.length, 1);
  assert.equal(taxonomy.tags[0].count, 2);
  assert.equal(taxonomy.categories.length, 1);
  assert.equal(taxonomy.categories[0].count, 2);
});

test('Browse automatically finds an older episode without Load more and preserves the selected filters', async () => {
  const resources = Array.from({ length: 125 }, (_, i) =>
    resourceFor(`ui-${i}`, 6000 + i)
  );
  setBridge(async (p) => {
    if (p.action === 'GET_USER_ACCOUNT')
      return { address: 'Qtest', publicKey: 'pk' };
    if (p.action === 'GET_PRIMARY_NAME') return 'Tester';
    if (p.action === 'GET_ACCOUNT_NAMES') return [{ name: 'Tester' }];
    if (p.action === 'SEARCH_QDN_RESOURCES') {
      if (p.identifier === 'qpodcasts-feedback-') return [];
      return p.limit === 1
        ? resources.slice(-1)
        : resources.slice(p.offset, p.offset + p.limit);
    }
    if (p.action === 'FETCH_QDN_RESOURCE') {
      const id = p.identifier.slice('qpodcasts-episode-'.length, -5);
      return {
        ...fixture(id, 'CatalogTester'),
        title: id === 'ui-111' ? 'Older episode needle' : 'Ordinary episode',
        description:
          id === 'ui-111' ? 'x'.repeat(500) + ' unique-description' : '',
        tags: id === 'ui-111' ? ['UniqueTag'] : [],
        categories: id === 'ui-111' ? ['Remote Category'] : [],
      };
    }
    return '/thumbnail';
  });
  await ensureCompleteCatalog(true);
  const view = await mount(<App />);
  await act(async () => {
    await pause(10);
  });
  const button = (label) =>
    [...view.node.querySelectorAll('button')].find(
      (item) => item.textContent === label
    );
  await act(async () => {
    button('Browse all Episodes')!.click();
    await pause(10);
  });
  const input = view.node.querySelector(
    'input[placeholder="Title, full description, @name, tag or category"]'
  );
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )!.set!;
  await act(async () => {
    setter.call(input, 'unique-description');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  const items = view.node.querySelectorAll('.browse-episodes__item');
  assert.equal(items.length, 1);
  assert.match(items[0].textContent!, /Older episode needle/);
  assert.equal(button('Load more episodes'), undefined);
  assert.match(view.node.textContent!, /Full catalog checked: 125/);
  const select = view.node.querySelector('select');
  await act(async () => {
    select.value = 'Remote Category';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(view.node.querySelectorAll('.browse-episodes__item').length, 1);
  assert.equal(select.value, 'Remote Category');
  await view.close();
});

test('catalog retry fetches only failed documents and reconciles withdrawn/deleted author rows', async () => {
  const resources = Array.from({ length: 3 }, (_, i) =>
    resourceFor(`reconcile-${i}`, 7000 + i)
  );
  let fail = true;
  let reads = 0;
  let deleted = false;
  scanFixture(resources, (p) => {
    reads++;
    if (fail && p.identifier.includes('reconcile-1-meta'))
      throw Error('unavailable');
    return {
      ...fixture(
        p.identifier.slice('qpodcasts-episode-'.length, -5),
        'CatalogTester'
      ),
      updatedAt: resources.find((item) => item.identifier === p.identifier)
        .updated,
      status:
        deleted && p.identifier.includes('reconcile-2-meta')
          ? 'deleted'
          : 'active',
    };
  });
  let state, own;
  function Probe() {
    state = usePodcastCrud('', false);
    own = usePodcastCrud('CatalogTester', false);
    return null;
  }
  const view = await mount(<Probe />);
  await act(async () => {
    await ensureCompleteCatalog(true);
  });
  assert.equal(state.catalogComplete, false);
  assert.equal(state.catalogFailed, 1);
  assert.equal(state.episodes.length, 2);
  fail = false;
  await act(async () => {
    await ensureCompleteCatalog(true);
  });
  assert.equal(state.catalogComplete, true);
  assert.equal(state.episodes.length, 3);
  assert.equal(reads, 4);
  await act(async () => {
    await own.loadEpisodes();
  });
  assert.equal(own.episodes.length, 3);
  resources.splice(0, 1);
  resources[1] = { ...resources[1], updated: 8000 };
  deleted = true;
  await act(async () => {
    await ensureCompleteCatalog(true);
  });
  assert.equal(state.episodes.length, 1);
  assert.equal(own.episodes.length, 1);
  assert.equal(state.episodes[0].episodeId, 'reconcile-1');
  resources[1] = { ...resources[1], updated: 8001 };
  deleted = false;
  await act(async () => {
    await ensureCompleteCatalog(true);
  });
  assert.equal(state.episodes.length, 2);
  assert.ok(state.episodes.some((item) => item.episodeId === 'reconcile-2'));
  await view.close();
});

test('cache without revision timestamps expires instead of silently reusing an unknown version forever', async () => {
  const resource = {
    name: 'NoRevision',
    identifier: 'qpodcasts-episode-no-revision-meta',
  };
  let reads = 0;
  setBridge(async () => {
    reads++;
    return { n: reads };
  });
  await readQdnDocument('episodes', resource);
  await readQdnDocument('episodes', resource);
  assert.equal(reads, 1);
  const clock = Date.now;
  Date.now = () => clock() + 61_000;
  try {
    assert.deepEqual(await readQdnDocument('episodes', resource), { n: 2 });
  } finally {
    Date.now = clock;
  }
});

test('catalog search supports @author, category and tag text consistently', () => {
  const item = {
    ...episode('query', 'MixedCaseAuthor'),
    tags: ['Orchard'],
    categories: ['Seasonal Garden'],
  };
  assert.equal(
    matchesPodcastFilters(item, { query: '@mixedcaseauthor' }),
    true
  );
  assert.equal(matchesPodcastFilters(item, { query: 'orchard' }), true);
  assert.equal(matchesPodcastFilters(item, { query: 'seasonal garden' }), true);
  assert.equal(matchesPodcastFilters(item, { tags: ['missing'] }), false);
});

test('catalog revalidation preserves a confirmed local publication until the index acknowledges it', async () => {
  let published;
  let advertised = false;
  setBridge(async (p) => {
    if (p.action === 'PUBLISH_QDN_RESOURCE') {
      if (p.service === 'PODCAST')
        published = JSON.parse(
          Buffer.from(p.base64, 'base64').toString('utf8')
        );
      return true;
    }
    if (p.action === 'FETCH_QDN_RESOURCE') return published;
    if (p.action === 'SEARCH_QDN_RESOURCES')
      return advertised
        ? [
            {
              name: 'LocalPublisher',
              identifier: `qpodcasts-episode-${published.episodeId}-meta`,
              created: published.createdAt,
              updated: published.updatedAt,
            },
          ]
        : [];
    return [];
  });
  let state;
  function Probe() {
    state = usePodcastCrud('', false);
    return null;
  }
  const view = await mount(<Probe />);
  await act(async () => {
    await state.createEpisode({
      ownerName: 'LocalPublisher',
      title: 'Waiting for index',
      description: 'Local confirmed content',
      tags: [],
      categories: [],
      audioFile: new File(['audio'], 'local.ogg'),
    });
  });
  const id = published.episodeId;
  await act(async () => {
    await ensureCompleteCatalog(true);
  });
  assert.ok(state.episodes.some((item) => item.episodeId === id));
  advertised = true;
  await act(async () => {
    await ensureCompleteCatalog(true);
  });
  assert.ok(state.episodes.some((item) => item.episodeId === id));
  advertised = false;
  await act(async () => {
    await ensureCompleteCatalog(true);
  });
  assert.equal(
    state.episodes.some((item) => item.episodeId === id),
    false
  );
  await view.close();
});

// RC.3: durable publication recovery and media preparation.
import { hashBlob, hashResponse } from '../src/services/media/contentHash';
import {
  coverDimensions,
  prepareCover,
} from '../src/services/media/prepareCover';
import {
  describeQdnStatus,
  waitForQdnMedia,
} from '../src/services/media/qdnMedia';
import {
  savePublicationJob,
  runPublicationJob,
  listPublicationJobs,
  getPublicationJob,
  forgetPublicationJob,
} from '../src/services/qdn/publicationJobs';
import {
  publicationPut,
  publicationGet,
  withPublicationLock,
} from '../src/services/qdn/publicationStorage';
import {
  getPublicationEntry,
  resourceJournalKey,
} from '../src/services/qdn/publicationJournal';
const draftInput = (ownerName: string) => ({
  ownerName,
  title: 'Recover me',
  description: 'A durable draft',
  tags: [],
  categories: [],
  audioFile: new File(['original-audio'], 'recovery.ogg', {
    type: 'audio/ogg',
    lastModified: 123,
  }),
});

test('content hashing detects changed bytes with identical file names, lengths and timestamps', async () => {
  const first = new File(['abc'], 'same.ogg', { lastModified: 1 });
  const second = new File(['xyz'], 'same.ogg', { lastModified: 1 });
  assert.equal(
    await hashBlob(first),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
  assert.notEqual(await hashBlob(first), await hashBlob(second));
  const big = new Blob([new Uint8Array(600000).fill(7)]);
  assert.equal(
    await hashBlob(big),
    await hashResponse(new Response(big), big.size)
  );
  await assert.rejects(hashResponse(new Response('wrong-length'), 3), /match/);
});

test('draft files survive a cold module and completed audio is not sent twice', async () => {
  const input = draftInput('ColdPublisher');
  const job = await savePublicationJob('create', input);
  assert.equal((await savePublicationJob('create', input)).key, job.key);
  assert.equal(
    (await listPublicationJobs('OtherPublisher')).some(
      (item) => item.key === job.key
    ),
    false
  );
  let audioWrites = 0,
    metadataWrites = 0,
    deny = true,
    metadata;
  setBridge(async (payload) => {
    if (payload.action === 'PUBLISH_QDN_RESOURCE') {
      if (payload.service === 'AUDIO') {
        audioWrites++;
        assert.equal(await payload.file.text(), 'original-audio');
        assert.equal(payload.file.name, 'recovery.ogg');
      } else {
        metadataWrites++;
        if (deny) throw Error('User declined');
        metadata = JSON.parse(
          Buffer.from(payload.base64, 'base64').toString('utf8')
        );
      }
      return true;
    }
    if (payload.action === 'FETCH_QDN_RESOURCE') return metadata;
    throw Error('Unexpected ' + payload.action);
  });
  await assert.rejects(runPublicationJob(job.key, 'ColdPublisher'), /declined/);
  assert.equal(audioWrites, 1);
  assert.ok(await publicationGet('files', job.audioKey));
  await assert.rejects(
    runPublicationJob(job.key, 'OtherPublisher'),
    /publisher/
  );
  // A new engine has no in-memory draft, journal, or file references.
  const cold = await import(
    /* @vite-ignore */ new URL(
      './publication-reload.mjs?cold=1',
      import.meta.url
    ).href
  );
  const restored = await cold.getPublicationJob(job.key);
  assert.equal(restored.episodeId, job.episodeId);
  deny = false;
  const result = await cold.runPublicationJob(job.key, 'ColdPublisher');
  assert.equal(result.status, 'complete');
  assert.equal(result.result.episodeId, job.episodeId);
  assert.equal(result.result.createdAt, job.operationTime);
  assert.equal(audioWrites, 1);
  assert.equal(metadataWrites, 2);
  assert.equal(await publicationGet('files', job.audioKey), undefined);
  assert.equal((await listPublicationJobs('ColdPublisher')).length, 0);
});

test('an uncertain audio step is checked by exact streamed bytes before recovery advances', async () => {
  const job = await savePublicationJob(
    'create',
    draftInput('UncertainPublisher')
  );
  let sends = 0,
    metadata;
  const originalFetch = globalThis.fetch;
  setBridge(async (payload) => {
    if (payload.action === 'PUBLISH_QDN_RESOURCE') {
      sends++;
      if (payload.service === 'AUDIO')
        throw Error('Bridge timed out after submission');
      metadata = JSON.parse(
        Buffer.from(payload.base64, 'base64').toString('utf8')
      );
      return true;
    }
    if (payload.action === 'GET_QDN_RESOURCE_STATUS')
      return { status: 'READY' };
    if (payload.action === 'GET_QDN_RESOURCE_URL')
      return '/existing-original-audio';
    if (payload.action === 'FETCH_QDN_RESOURCE') return metadata;
    throw Error('Unexpected ' + payload.action);
  });
  try {
    await assert.rejects(
      runPublicationJob(job.key, 'UncertainPublisher'),
      /timed out/
    );
    globalThis.fetch = async () => new Response('different-data');
    await assert.rejects(
      runPublicationJob(job.key, 'UncertainPublisher'),
      /No duplicate/
    );
    assert.equal(sends, 1);
    globalThis.fetch = async () => new Response('original-audio');
    const result = await runPublicationJob(job.key, 'UncertainPublisher');
    assert.equal(result.status, 'complete');
    assert.equal(sends, 2);
    assert.equal(
      (await getPublicationEntry(result.result.audio)).state,
      'confirmed'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Check status completes a crash after metadata submission without another paid write', async () => {
  const job = await savePublicationJob('create', draftInput('CheckPublisher'));
  const metadata = {
    ...fixture(job.episodeId, 'CheckPublisher'),
    createdAt: job.operationTime,
    updatedAt: job.operationTime,
    audio: {
      service: 'AUDIO',
      name: job.ownerName,
      identifier: `qpodcasts-episode-${job.episodeId}-audio`,
      filename: 'recovery.ogg',
    },
  };
  const base64 = Buffer.from(JSON.stringify(metadata)).toString('base64');
  const { hash, size } = await import('../src/services/media/contentHash').then(
    (module) => module.hashBase64(base64)
  );
  const audio = metadata.audio;
  const resource = {
    service: 'PODCAST',
    name: job.ownerName,
    identifier: `qpodcasts-episode-${job.episodeId}-meta`,
  };
  await publicationPut('resources', {
    key: resourceJournalKey(audio),
    resource: audio,
    hash: await hashBlob(draftInput('x').audioFile),
    size: 14,
    state: 'confirmed',
    updatedAt: 1,
  });
  await publicationPut('resources', {
    key: resourceJournalKey(resource),
    resource,
    hash,
    size,
    expectedBase64: base64,
    state: 'pending',
    updatedAt: 1,
  });
  await publicationPut('jobs', { ...job, status: 'running' });
  let sends = 0;
  setBridge(async (p) => {
    if (p.action === 'PUBLISH_QDN_RESOURCE') {
      sends++;
      throw Error('Must not publish');
    }
    if (p.action === 'GET_QDN_RESOURCE_STATUS') return { status: 'READY' };
    if (p.action === 'FETCH_QDN_RESOURCE') return base64;
    throw Error('Unexpected ' + p.action);
  });
  const result = await runPublicationJob(job.key, job.ownerName, {
    checkOnly: true,
  });
  assert.equal(result.status, 'complete');
  assert.equal(result.result.episodeId, job.episodeId);
  assert.equal(sends, 0);
  assert.equal(await publicationGet('files', job.audioKey), undefined);
});

test('strict draft storage fails before publishing when IndexedDB is unavailable', async () => {
  const saved = globalThis.indexedDB;
  let writes = 0;
  setBridge(async () => {
    writes++;
    return true;
  });
  try {
    globalThis.indexedDB = undefined;
    const cold = await import(
      /* @vite-ignore */ new URL(
        './publication-reload.mjs?no-storage=1',
        import.meta.url
      ).href
    );
    await assert.rejects(
      cold.savePublicationJob('create', draftInput('NoStorage')),
      /storage|save/i
    );
    assert.equal(writes, 0);
    // Storage can become available without trapping the engine in a rejected cache.
    globalThis.indexedDB = saved;
    const job = await cold.savePublicationJob(
      'create',
      draftInput('NoStorage')
    );
    await cold.forgetPublicationJob(job.key, 'NoStorage');
  } finally {
    globalThis.indexedDB = saved;
  }
});

test('publication leases reject a concurrent writer and release for the next attempt', async () => {
  let release;
  const held = withPublicationLock(
    'lease-test',
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  while (!release) await pause();
  await assert.rejects(
    withPublicationLock('lease-test', async () => true),
    /another tab/
  );
  release(true);
  await held;
  assert.equal(await withPublicationLock('lease-test', async () => 42), 42);
});

test('removing a local draft frees its saved blobs without QDN deletion', async () => {
  const job = await savePublicationJob('create', draftInput('ForgetPublisher'));
  let calls = 0;
  setBridge(async () => {
    calls++;
    return true;
  });
  await forgetPublicationJob(job.key, job.ownerName);
  assert.equal(await getPublicationJob(job.key), undefined);
  assert.equal(await publicationGet('files', job.audioKey), undefined);
  assert.equal(calls, 0);
});

test('QDN progress uses server chunks and does not treat a finished download as ready', () => {
  assert.equal(
    describeQdnStatus({
      status: 'DOWNLOADING',
      localChunkCount: 2,
      totalChunkCount: 8,
    }).percent,
    25
  );
  assert.equal(
    describeQdnStatus({ status: 'DOWNLOADED', percentLoaded: 100 }).phase,
    'building'
  );
  assert.equal(describeQdnStatus({ status: 'BUILDING' }).phase, 'building');
  assert.equal(
    describeQdnStatus({ status: 'DOWNLOADING', percentLoaded: 150 }).percent,
    100
  );
  assert.equal(describeQdnStatus({ status: 'DOWNLOADING' }).percent, undefined);
});

test('cancelled QDN selection cannot proceed to URL resolution or replace a newer episode', async () => {
  let controls, releaseOld;
  const urls = [];
  setBridge(async (p) => {
    if (p.action === 'GET_QDN_RESOURCE_STATUS') {
      if (p.identifier === 'audio-obsolete')
        return new Promise((resolve) => {
          releaseOld = resolve;
        });
      return { status: 'READY' };
    }
    if (p.action === 'GET_QDN_RESOURCE_URL') {
      urls.push(p.identifier);
      return '/' + p.identifier;
    }
    throw Error('Unexpected ' + p.action);
  });
  function Probe() {
    controls = useGlobalPlayback();
    return null;
  }
  const view = await mount(
    <GlobalPlaybackProvider>
      <Probe />
    </GlobalPlaybackProvider>
  );
  let old;
  await act(async () => {
    old = controls.playEpisode(episode('obsolete'));
    await pause();
    await controls.playEpisode(episode('latest'));
  });
  await act(async () => {
    releaseOld({ status: 'READY' });
    await old;
  });
  assert.equal(controls.audioUrl, '/audio-latest?v=1');
  assert.deepEqual(urls, ['audio-latest']);
  await view.close();
});

test('QDN blocking and preparation timeout surface clear retry errors', async () => {
  setBridge(async () => ({ status: 'BLOCKED' }));
  await assert.rejects(
    waitForQdnMedia({
      service: 'AUDIO',
      name: 'Status',
      identifier: 'blocked',
    }),
    /blocked/
  );
  setBridge(async () => ({ status: 'BUILDING' }));
  await assert.rejects(
    waitForQdnMedia(
      { service: 'IMAGE', name: 'Status', identifier: 'building' },
      { maxWaitMs: 0 }
    ),
    /Retry/
  );
});

test('cover resize preserves proportions, limits large images, and never upscales', () => {
  assert.deepEqual(coverDimensions(4000, 3000), { width: 1024, height: 768 });
  assert.deepEqual(coverDimensions(240, 320), { width: 240, height: 320 });
  assert.deepEqual(coverDimensions(1000, 4000), { width: 256, height: 1024 });
  assert.throws(() => coverDimensions(0, 400));
});

test('cover preparation keeps small images, encodes large ones, and closes decoded bitmaps', async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const prototype = window.HTMLCanvasElement.prototype;
  const context = prototype.getContext,
    toBlob = prototype.toBlob;
  let closed = 0,
    dimensions = [4000, 3000],
    drawn,
    encodedType;
  globalThis.createImageBitmap = async () => ({
    width: dimensions[0],
    height: dimensions[1],
    close() {
      closed++;
    },
  });
  prototype.getContext = function () {
    return {
      drawImage: (_image, _x, _y, w, h) => {
        drawn = [w, h];
      },
      fillRect() {},
    };
  };
  prototype.toBlob = function (callback, type) {
    encodedType = type;
    callback(new Blob(['compressed'], { type }));
  };
  try {
    const large = new File(['source'], 'cover.png', {
      type: 'image/png',
      lastModified: 9,
    });
    const result = await prepareCover(large);
    assert.deepEqual(drawn, [1024, 768]);
    assert.equal(encodedType, 'image/webp');
    assert.equal(result.name, 'cover-cover.webp');
    assert.equal(result.lastModified, 9);
    assert.equal(closed, 1);
    dimensions = [200, 150];
    assert.equal(await prepareCover(large), large);
    assert.equal(closed, 2);
    await assert.rejects(
      prepareCover(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.png')
      ),
      /10 MB/
    );
    assert.equal(closed, 2);
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    prototype.getContext = context;
    prototype.toBlob = toBlob;
  }
});

test('cover fallback flattens JPEG transparency and releases resources after encoding errors', async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const prototype = window.HTMLCanvasElement.prototype;
  const context = prototype.getContext,
    toBlob = prototype.toBlob;
  let closed = 0,
    filled = 0,
    failing = false;
  const formats = [];
  globalThis.createImageBitmap = async () => ({
    width: 2048,
    height: 2048,
    close() {
      closed++;
    },
  });
  prototype.getContext = () => ({
    drawImage() {},
    fillRect() {
      filled++;
    },
  });
  prototype.toBlob = function (callback, type) {
    formats.push(type);
    callback(
      failing
        ? null
        : new Blob(['image'], {
            type: type === 'image/webp' ? 'image/png' : type,
          })
    );
  };
  try {
    const file = new File(['data'], 'art.png', { type: 'image/png' });
    const result = await prepareCover(file);
    assert.equal(result.type, 'image/jpeg');
    assert.equal(result.name, 'art-cover.jpg');
    assert.equal(filled, 1);
    assert.deepEqual(formats, ['image/webp', 'image/jpeg']);
    assert.equal(closed, 1);
    failing = true;
    await assert.rejects(prepareCover(file), /prepare/);
    assert.equal(closed, 2);
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    prototype.getContext = context;
    prototype.toBlob = toBlob;
  }
});

import {
  IdentityProvider,
  useIdentity,
} from '../src/features/identity/context/IdentityContext';
import PublicationRecoveryPanel from '../src/features/podcasts/components/PublicationRecoveryPanel';
test('reopened recovery panel displays only the active publishers saved drafts', async () => {
  const first = await savePublicationJob('create', {
    ...draftInput('RecoveryUI'),
    title: 'First publisher saved draft',
  });
  const second = await savePublicationJob('create', {
    ...draftInput('RecoveryOtherUI'),
    title: 'Other publisher saved draft',
  });
  let identity;
  setBridge(async (p) => {
    if (p.action === 'GET_USER_ACCOUNT')
      return { address: 'QUITest', publicKey: 'pk' };
    if (p.action === 'GET_PRIMARY_NAME') return 'RecoveryUI';
    if (p.action === 'GET_ACCOUNT_NAMES')
      return [{ name: 'RecoveryUI' }, { name: 'RecoveryOtherUI' }];
    throw Error('No publication expected');
  });
  function Probe() {
    identity = useIdentity();
    return <PublicationRecoveryPanel />;
  }
  const view = await mount(
    <IdentityProvider>
      <Probe />
    </IdentityProvider>
  );
  await act(async () => {
    await pause(20);
  });
  assert.match(view.node.textContent, /First publisher saved draft/);
  assert.doesNotMatch(view.node.textContent, /Other publisher saved draft/);
  await act(async () => {
    await identity.setActiveName('RecoveryOtherUI');
    await pause(20);
  });
  await act(async () => {
    await pause(20);
  });
  assert.match(view.node.textContent, /Other publisher saved draft/);
  assert.doesNotMatch(view.node.textContent, /First publisher saved draft/);
  await view.close();
  await forgetPublicationJob(first.key, first.ownerName);
  await forgetPublicationJob(second.key, second.ownerName);
});

import FloatingMiniPlayer from '../src/features/podcasts/components/FloatingMiniPlayer';
test('late autoplay rejection from a replaced audio element cannot mark the current episode failed', async () => {
  const prototype = window.HTMLMediaElement.prototype;
  const play = prototype.play;
  let rejectOld,
    controls,
    calls = 0;
  prototype.play = function () {
    calls++;
    return calls === 1
      ? new Promise((_resolve, reject) => {
          rejectOld = reject;
        })
      : Promise.resolve();
  };
  setBridge(async (p) =>
    p.action === 'GET_QDN_RESOURCE_STATUS'
      ? { status: 'READY' }
      : '/player-' + p.identifier
  );
  function Probe() {
    controls = useGlobalPlayback();
    return <FloatingMiniPlayer />;
  }
  const view = await mount(
    <GlobalPlaybackProvider>
      <Probe />
    </GlobalPlaybackProvider>
  );
  try {
    await act(async () => {
      await controls.playEpisode(episode('autoplay-old'));
    });
    assert.equal(calls, 1);
    const oldAudio = view.node.querySelector('audio');
    await act(async () => {
      await controls.playEpisode(episode('autoplay-new'));
    });
    assert.notEqual(view.node.querySelector('audio'), oldAudio);
    await act(async () => {
      rejectOld(Error('Old playback failed'));
      await pause();
    });
    assert.equal(controls.playbackError, null);
    assert.equal(controls.currentEpisode.episodeId, 'autoplay-new');
    await act(async () => {
      view.node
        .querySelector('audio')
        .dispatchEvent(new window.Event('playing'));
    });
    assert.equal(controls.isPlaying, true);
    assert.equal(controls.isAudioLoading, false);
  } finally {
    await view.close();
    prototype.play = play;
  }
});

import EpisodeThumbnail from '../src/features/podcasts/components/EpisodeThumbnail';
test('retrying an externally supplied failed cover rechecks QDN and bypasses the failed image URL', async () => {
  let statuses = 0;
  setBridge(async (p) => {
    if (p.action === 'GET_QDN_RESOURCE_STATUS') {
      statuses++;
      return { status: 'READY' };
    }
    if (p.action === 'GET_QDN_RESOURCE_URL') return '/recovered-cover';
    throw Error('Unexpected ' + p.action);
  });
  const item = {
    ...episode('cover-retry'),
    thumbnail: {
      service: 'IMAGE',
      name: 'Tester',
      identifier: 'cover-retry',
      filename: 'cover.webp',
    },
  };
  const view = await mount(
    <EpisodeThumbnail src="/failed-cover" alt="Test cover" episode={item} />
  );
  try {
    await act(async () => {
      view.node.querySelector('img').dispatchEvent(new window.Event('error'));
    });
    await act(async () => {
      view.node.querySelector('button').click();
      await pause();
    });
    assert.equal(statuses, 1);
    assert.match(
      view.node.querySelector('img').getAttribute('src'),
      /recovered-cover.*coverRetry=1/
    );
  } finally {
    await view.close();
  }
});
