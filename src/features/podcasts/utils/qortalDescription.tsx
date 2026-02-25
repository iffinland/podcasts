import { MouseEvent, ReactNode } from 'react';

const QORTAL_LINK_REGEX = /qortal:\/\/[^\s]+/gi;
const TRAILING_PUNCTUATION_REGEX = /[.,!?;:)\]}]+$/;

const splitLinkAndTrailingPunctuation = (value: string) => {
  const trailingMatch = value.match(TRAILING_PUNCTUATION_REGEX);
  if (!trailingMatch) {
    return { link: value, trailing: '' };
  }

  const trailing = trailingMatch[0];
  return {
    link: value.slice(0, value.length - trailing.length),
    trailing,
  };
};

export const renderQortalLinkedText = (value: string): ReactNode => {
  return renderQortalLinkedTextWithOptions(value, {
    openInNewTab: true,
  });
};

interface RenderQortalLinkedTextOptions {
  openInNewTab?: boolean;
  onLinkClick?: (link: string, event: MouseEvent<HTMLAnchorElement>) => void;
}

export const renderQortalLinkedTextWithOptions = (
  value: string,
  options?: RenderQortalLinkedTextOptions
): ReactNode => {
  if (!value) {
    return value;
  }

  const { openInNewTab = true, onLinkClick } = options ?? {};
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(QORTAL_LINK_REGEX)) {
    const matchIndex = match.index ?? -1;
    if (matchIndex < 0) {
      continue;
    }

    if (matchIndex > lastIndex) {
      nodes.push(value.slice(lastIndex, matchIndex));
    }

    const rawLink = match[0];
    const { link, trailing } = splitLinkAndTrailingPunctuation(rawLink);

    if (link.length > 0) {
      nodes.push(
        <a
          key={`${matchIndex}-${link}`}
          href={link}
          onClick={
            onLinkClick
              ? (event) => {
                  onLinkClick(link, event);
                }
              : undefined
          }
          {...(openInNewTab
            ? {
                target: '_blank',
                rel: 'noopener noreferrer',
              }
            : {})}
        >
          {link}
        </a>
      );
    }

    if (trailing.length > 0) {
      nodes.push(trailing);
    }

    lastIndex = matchIndex + rawLink.length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : value;
};

export const buildQortalAwarePreview = (
  value: string,
  limit = 200
): { text: string; isLong: boolean } => {
  if (!value) {
    return { text: '', isLong: false };
  }

  if (value.length <= limit) {
    return { text: value, isLong: false };
  }

  const links = Array.from(value.matchAll(QORTAL_LINK_REGEX));
  if (links.length > 1) {
    return { text: value, isLong: false };
  }

  let cutIndex = limit;

  for (const match of links) {
    const start = match.index ?? -1;
    if (start < 0) {
      continue;
    }
    const end = start + match[0].length;
    if (start < limit && end > limit) {
      cutIndex = end;
      break;
    }
  }

  const isLong = cutIndex < value.length;
  if (!isLong) {
    return { text: value, isLong: false };
  }

  return {
    text: `${value.slice(0, cutIndex).trimEnd()}…`,
    isLong: true,
  };
};
