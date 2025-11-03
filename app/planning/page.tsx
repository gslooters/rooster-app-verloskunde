'use client';
import React from 'react';
import Wizard from './_components/Wizard';

export default function PlanningPage() {
  return (
    <main className="p-6">
      <nav className="text-sm text-gray-500 mb-4">Dashboard &gt; Rooster Planning</nav>
      <h1 className="text-2xl font-semibold mb-4">Rooster Planning</h1>
      <p className="text-gray-600 mb-6">Maak en beheer personeelsroosters voor 5-weken periodes.</p>
      
      <Wizard />
      
      <section className="mt-8 p-4 border rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-3">Bestaande roosters</h2>
        <p className="text-gray-500 text-sm">Hier komt een overzicht van bestaande roosters (localStorage of API).</p>
      </section>
    </main>
  );
}
