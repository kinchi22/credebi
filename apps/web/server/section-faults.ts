export const SECTION_FAULTS_COOKIE = 'credebi-faults';

export const SECTIONS = [
  'settings.entry-form-mode',
  'settings.accounts',
  'settings.language',
  'settings.connections',
  'entries.form',
  'entries.list',
  'income-statement.report',
  'assets-and-liabilities.report',
  'assets-and-liabilities-trend.chart',
  'entry-search.results',
] as const;

export type Section = (typeof SECTIONS)[number];

type Mode = 'hold' | 'fail';

export type Latch = {
  readonly opened: Promise<void>;
  readonly open: () => void;
};

export type SectionFaults = {
  readonly run: <T>(
    section: Section,
    cookie: string | undefined,
    read: () => Promise<T>,
  ) => Promise<T>;
  readonly release: (token: string, section: string) => boolean;
};

export const SECTION_FAULT = 'Injected section fault.';

export function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

function faultOf(
  cookie: string,
  section: Section,
): { readonly token: string; readonly mode: Mode } | null {
  const [token = '', list = '', ...rest] = cookie.split(';');
  if (token === '' || rest.length > 0) return null;
  for (const item of list.split(',')) {
    const [name, mode] = item.split(':');
    if (name === section && (mode === 'hold' || mode === 'fail')) return { token, mode };
  }
  return null;
}

function newLatch(): Latch {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

export const noSectionFaults: SectionFaults = {
  run: (_section, _cookie, read) => read(),
  release: () => false,
};

export function createSectionFaults(latches: Map<string, Latch>): SectionFaults {
  const latchOf = (token: string, section: string): Latch => {
    const key = `${token}/${section}`;
    const existing = latches.get(key);
    if (existing !== undefined) return existing;
    const created = newLatch();
    latches.set(key, created);
    return created;
  };

  return {
    run: async (section, cookie, read) => {
      const fault = faultOf(cookie ?? '', section);
      if (fault === null) return read();
      if (fault.mode === 'fail') throw new Error(SECTION_FAULT);
      await latchOf(fault.token, section).opened;
      return read();
    },
    release: (token, section) => {
      if (!isSection(section)) return false;
      latchOf(token, section).open();
      return true;
    },
  };
}
