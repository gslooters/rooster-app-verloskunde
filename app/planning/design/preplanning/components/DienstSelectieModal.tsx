interface DienstSelectieModalProps {
  isOpen: boolean;
  cellData: ModalCellData | null;
  onClose: () => void;
  onSave: (serviceId: string | null, status: CellStatus) => void;
  readOnly?: boolean;
  isSaving?: boolean; // TOEGEVOEGD
}

export default function DienstSelectieModal({
  isOpen,
  cellData,
  onClose,
  onSave,
  readOnly = false,
  isSaving = false // TOEGEVOEGD
}: DienstSelectieModalProps) {
  ...
  
  // VERWIJDEREN: const [isSaving, setIsSaving] = useState(false);
  // We gebruiken nu de prop van parent component

  ...

  // Save handler - geen setIsSaving meer
  function handleSave() {
    if (selectedStatus === 1) {
      if (!selectedServiceId) {
        alert('Selecteer een dienst');
        return;
      }
      onSave(selectedServiceId, 1);
    } else if (selectedStatus === 0) {
      onSave(null, 0);
    } else if (selectedStatus === 2) {
      onSave(null, 2);
    } else if (selectedStatus === 3) {
      onSave(null, 3);
    }
    // Parent regelt isSaving en modal sluiten
  }

  // BACKDROP CLICK - blokkeer tijdens save
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isSaving) return;
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  ...

  {/* Sluiten Button */}
  <button
    onClick={onClose}
    disabled={isSaving}
    className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    aria-label="Sluiten"
  >
    <X className="w-5 h-5" />
  </button>
  
  {/* Annuleren Button */}
  <button
    onClick={onClose}
    disabled={isSaving}
    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Annuleren
  </button>

  {/* Radio Buttons */}
  <input
    type="radio"
    ...
    disabled={readOnly || isSaving}
  />

  {/* Opslaan knop (disabled tijdens save) */}
  <button
    onClick={handleSave}
    disabled={isSaving || !hasChanges}
    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
  >
    {isSaving ? 'Opslaan...' : 'Opslaan'}
  </button>

...
