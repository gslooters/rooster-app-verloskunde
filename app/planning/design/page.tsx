import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const Wrapper = dynamic(() => import('./wrapper'), { ssr: false });

export default function Page() {
  return (
    <Suspense>
      <Wrapper />
    </Suspense>
  );
}
