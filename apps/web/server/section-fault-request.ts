import 'server-only';
import { cookies } from 'next/headers';
import { getContainer } from './container';
import { SECTION_FAULTS_COOKIE, type Section } from './section-faults';

export async function withSectionFault<T>(section: Section, read: () => Promise<T>): Promise<T> {
  const { sectionFaults } = getContainer();
  const cookie = (await cookies()).get(SECTION_FAULTS_COOKIE)?.value;
  return sectionFaults.run(section, cookie, read);
}
