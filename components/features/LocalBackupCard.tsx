import { Download, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useIsOwner } from '@/hooks/useIsOwner';
import { importDiaryEntriesAndSync } from '@/services/diaryActions';
import { BackupError, createDiaryBackupJson, parseDiaryBackup } from '@/services/localBackup';
import { getLocalDateKey } from '@/utils/calendarDates';
import { downloadTextFile, pickTextFile } from '@/utils/fileTransfer';
import { useSyncStore } from '@/store/syncStore';
import { useToastStore } from '@/store/toastStore';
import { isOwnerEmail } from '@/utils/ownerAccess';

type BusyAction = 'export' | 'import';

function toast(message: string, variant: 'success' | 'error') {
  useToastStore.getState().show(message, variant);
}

function isSignedInAsOwner(): boolean {
  return isOwnerEmail(useSyncStore.getState().session?.user.email);
}

/** Owner-only export/import of the diary as a JSON file - a manual safety net independent of cloud sync. Web (PWA) only: it relies on browser download/file-picker APIs. */
export function LocalBackupCard() {
  const isOwner = useIsOwner();
  const [busy, setBusy] = useState<BusyAction | null>(null);

  if (Platform.OS !== 'web' || !isOwner) return null;

  async function handleExport() {
    // Re-checked at action time so a stale render can never run this for a non-owner session.
    if (!isSignedInAsOwner()) return;
    setBusy('export');
    try {
      const json = await createDiaryBackupJson();
      downloadTextFile(`coach-imi-backup-${getLocalDateKey()}.json`, json);
      toast('Backup exportiert.', 'success');
    } catch (err) {
      console.error('[backup] export failed', err);
      toast('Backup konnte nicht exportiert werden.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!isSignedInAsOwner()) return;
    setBusy('import');
    try {
      const text = await pickTextFile();
      if (text === null) return;

      const { entriesByDate, importedCount, skippedCount } = parseDiaryBackup(text);
      const added = await importDiaryEntriesAndSync(entriesByDate);
      const skippedNote = skippedCount > 0 ? ` (${skippedCount} ungültige übersprungen)` : '';
      toast(
        added > 0
          ? `${added} Einträge importiert${skippedNote}.`
          : `Nichts zu importieren – alle ${importedCount} Einträge sind bereits vorhanden${skippedNote}.`,
        'success',
      );
    } catch (err) {
      console.error('[backup] import failed', err);
      toast(err instanceof BackupError ? err.message : 'Backup konnte nicht importiert werden.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="gap-3">
      <Text className="text-sm font-semibold text-text-secondary">Lokales Backup</Text>
      <Text className="text-xs text-text-secondary">
        Sichert dein Tagebuch als JSON-Datei. Beim Import werden fehlende Einträge hinzugefügt und in die Cloud übertragen –
        bestehende Einträge bleiben unverändert.
      </Text>
      <View className="gap-2">
        <Button
          label="Export Local Backup"
          variant="secondary"
          icon={<Download color="#A1A1AA" size={18} />}
          loading={busy === 'export'}
          disabled={busy !== null}
          onPress={handleExport}
        />
        <Button
          label="Import Local Backup"
          variant="secondary"
          icon={<Upload color="#A1A1AA" size={18} />}
          loading={busy === 'import'}
          disabled={busy !== null}
          onPress={handleImport}
        />
      </View>
    </Card>
  );
}
