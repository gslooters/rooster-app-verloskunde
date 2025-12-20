/**
 * DRAAD224: Placeholder Screen for Roosterbewerking
 * 
 * Shown after user clicks "Roosterbewerking starten"
 * Displays message and OK button to proceed to bewerking screen
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Construction } from 'lucide-react';

export default function PlaceholderBewerkingPage() {
  const params = useParams();
  const router = useRouter();
  const rosterId = params.id as string;

  const handleOk = () => {
    console.log(`[DRAAD224] Placeholder OK clicked - routing to bewerking`);
    router.push(`/rooster/${rosterId}/bewerking`);
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className="rounded-full bg-orange-100 p-4">
              <Construction className="h-12 w-12 text-orange-600" />
            </div>
            
            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900">
              Tijdelijk Scherm
            </h1>
            
            {/* Message */}
            <div className="space-y-2">
              <p className="text-lg text-gray-700">
                Hier gaan we auto-fill voor Roosterbewerking bouwen
              </p>
              <p className="text-sm text-gray-600">
                Voor nu wordt het rooster handmatig ingevuld in het bewerkingsscherm.
              </p>
            </div>
            
            {/* OK Button */}
            <Button
              onClick={handleOk}
              className="mt-4 px-8 py-6 text-lg"
              size="lg"
            >
              OK - Ga naar Roosterbewerking
            </Button>
            
            {/* Info text */}
            <p className="text-xs text-gray-500 mt-4">
              Rooster status is geüpdatet naar &quot;in bewerking&quot;
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
