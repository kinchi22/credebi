import { type ReactNode } from 'react';
import { en } from '../messages/en';

export const metadata = {
  title: en.notFoundPage.title,
};

export default function NotFoundPage(): ReactNode {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4 wide:p-8">
      <h1 className="text-h1">{en.notFoundPage.title}</h1>
    </main>
  );
}
