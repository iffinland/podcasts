import {
  requestQortal,
  type QortalRequestOptions,
} from '../qortal/qortalClient';
import type { QdnResource } from '../cache/qdnDocumentCache';
export async function discoverResources(
  prefix: string,
  onPage: (resources: QdnResource[]) => void,
  options: {
    ownerName?: string;
    priority?: QortalRequestOptions['priority'];
  } = {}
) {
  const resources = new Map<string, QdnResource>();
  let offset = 0;
  // Use Core's latest creation timestamp, rather than trusting the device clock.
  const head = await requestQortal<QdnResource[]>(
    {
      action: 'SEARCH_QDN_RESOURCES',
      service: 'PODCAST',
      identifier: prefix,
      prefix: true,
      mode: 'ALL',
      reverse: true,
      limit: 1,
      offset: 0,
      ...(options.ownerName
        ? { name: options.ownerName, exactMatchNames: true }
        : {}),
    },
    { priority: options.priority ?? 'background' }
  );
  if (!Array.isArray(head))
    throw new Error('Invalid QDN resource search response.');
  const before =
    head.length === 1 && Number.isFinite(head[0]?.created)
      ? head[0].created! + 1
      : undefined;
  let previousPage = '';
  while (true) {
    const page = await requestQortal<QdnResource[]>(
      {
        action: 'SEARCH_QDN_RESOURCES',
        service: 'PODCAST',
        identifier: prefix,
        prefix: true,
        mode: 'ALL',
        reverse: false,
        limit: 100,
        offset,
        ...(before === undefined ? {} : { before }),
        ...(options.ownerName
          ? { name: options.ownerName, exactMatchNames: true }
          : {}),
      },
      { priority: options.priority ?? 'background' }
    );
    if (!Array.isArray(page))
      throw new Error('Invalid QDN resource search response.');
    const valid = page.filter(
      (item) =>
        item &&
        typeof item.name === 'string' &&
        typeof item.identifier === 'string' &&
        item.identifier.startsWith(prefix)
    );
    if (valid.length !== page.length)
      throw new Error('QDN returned invalid resource references.');
    const signature = JSON.stringify(
      valid.map((item) => [item.name, item.identifier])
    );
    if (page.length === 100 && signature === previousPage)
      throw new Error('QDN pagination did not advance. Please retry.');
    previousPage = signature;
    for (const item of valid)
      resources.set(
        JSON.stringify([item.name.toLowerCase(), item.identifier]),
        item
      );
    onPage([...resources.values()]);
    if (page.length < 100) break;
    offset += 100;
  }
  return [...resources.values()];
}
