import { Suspense } from 'react';
import RosterDesignPageWrapper from './wrapper';

export default function Page() {
  return (
    <Suspense>
      <RosterDesignPageWrapper />
    </Suspense>
  );
}
