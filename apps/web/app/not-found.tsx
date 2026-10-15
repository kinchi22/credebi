import { typeClasses } from '@repo/ui/type-classes';
import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFoundPage');
  return { title: t('title') };
}

export default async function NotFoundPage(): Promise<ReactNode> {
  const t = await getTranslations('notFoundPage');
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4 wide:p-8">
      <h1 className={typeClasses.h1}>{t('title')}</h1>
    </main>
  );
}
