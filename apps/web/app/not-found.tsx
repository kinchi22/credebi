import { type ReactNode } from 'react';
import { en } from '../messages/en';

export const metadata = {
  title: en.notFoundPage.title,
};

export default function NotFoundPage(): ReactNode {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">{en.notFoundPage.title}</h1>
    </main>
  );
}
