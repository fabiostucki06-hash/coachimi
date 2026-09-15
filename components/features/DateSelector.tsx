import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { todayKey } from '@/store/diaryStore';
import { useUiStore } from '@/store/uiStore';
import { addDays, buildMonthGrid, monthYearOf, WEEKDAY_LABELS } from '@/utils/calendarDates';

const ACCENT = '#6366F1';

function formatDayLabel(dateKey: string): string {
  const today = todayKey();
  const diffDays = Math.round(
    (new Date(`${dateKey}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000,
  );
  if (diffDays === 0) return 'Heute';
  if (diffDays === -1) return 'Gestern';
  if (diffDays === 1) return 'Morgen';
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
  });
}

interface DateSelectorProps {
  /** Called with the tapped date when a calendar-grid day is picked (not the prev/next arrows) - lets the caller open a detail view for that day. */
  onDaySelected?: (dateKey: string) => void;
  /** Renders as a borderless inline row (no card chrome) for embedding in the header bar; the expandable calendar grid still opens below it. */
  compact?: boolean;
}

export function DateSelector({ onDaySelected, compact = false }: DateSelectorProps = {}) {
  const selectedDate = useUiStore((state) => state.selectedDate);
  const setSelectedDate = useUiStore((state) => state.setSelectedDate);
  const [expanded, setExpanded] = useState(false);
  const [viewedMonth, setViewedMonth] = useState(() => monthYearOf(selectedDate));

  const isToday = selectedDate === todayKey();

  function jumpToMonthOf(dateKey: string) {
    setViewedMonth(monthYearOf(dateKey));
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setExpanded(false);
    onDaySelected?.(dateKey);
  }

  function goToToday() {
    const key = todayKey();
    setSelectedDate(key);
    jumpToMonthOf(key);
  }

  function shiftMonth(delta: number) {
    setViewedMonth((prev) => {
      const total = prev.year * 12 + prev.month + delta;
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
    });
  }

  const monthLabel = new Date(Date.UTC(viewedMonth.year, viewedMonth.month, 1)).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View className={compact ? 'relative gap-1.5' : 'gap-3 rounded-[28px] border border-surface-border bg-surface p-4 shadow-md shadow-black/20 backdrop-blur-xl'}>
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityLabel="Vorheriger Tag"
          className={compact ? 'h-8 w-8 items-center justify-center rounded-full active:bg-white/5' : 'h-10 w-10 items-center justify-center rounded-full active:bg-white/5'}
          onPress={() => setSelectedDate(addDays(selectedDate, -1))}
        >
          <ChevronLeft color="#A1A1AA" size={compact ? 16 : 20} />
        </Pressable>

        <Pressable
          className={compact ? 'flex-row items-center justify-center gap-1.5 px-1' : 'flex-1 flex-row items-center justify-center gap-2 px-2'}
          onPress={() => {
            jumpToMonthOf(selectedDate);
            setExpanded((prev) => !prev);
          }}
        >
          {!compact && <Calendar color={ACCENT} size={16} />}
          <Text className={compact ? 'text-xs font-semibold text-white' : 'text-sm font-semibold text-white'}>{formatDayLabel(selectedDate)}</Text>
          {!isToday && (
            <Text className="text-xs text-text-secondary">
              {new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="Nächster Tag"
          className={compact ? 'h-8 w-8 items-center justify-center rounded-full active:bg-white/5' : 'h-10 w-10 items-center justify-center rounded-full active:bg-white/5'}
          onPress={() => setSelectedDate(addDays(selectedDate, 1))}
        >
          <ChevronRight color="#A1A1AA" size={compact ? 16 : 20} />
        </Pressable>
      </View>

      {!isToday && (
        <Pressable
          className={compact ? 'self-center rounded-full bg-primary/10 px-2.5 py-0.5 active:bg-primary/20' : 'self-center rounded-full bg-primary/10 px-4 py-1.5 active:bg-primary/20'}
          onPress={goToToday}
        >
          <Text className={compact ? 'text-[10px] font-semibold text-primary' : 'text-xs font-semibold text-primary'}>
            {compact ? 'Heute' : 'Zu Heute springen'}
          </Text>
        </Pressable>
      )}

      {expanded && (
        <View className={compact ? 'absolute right-0 top-full z-10 mt-2 w-72 gap-3 rounded-[24px] border border-surface-border bg-surface p-4 shadow-2xl shadow-black/40' : 'gap-3 border-t border-surface-border pt-3 '}>
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityLabel="Vorheriger Monat"
              className="h-8 w-8 items-center justify-center rounded-full active:bg-white/5"
              onPress={() => shiftMonth(-1)}
            >
              <ChevronLeft color="#A1A1AA" size={16} />
            </Pressable>
            <Text className="text-xs font-semibold capitalize text-text-secondary">{monthLabel}</Text>
            <Pressable
              accessibilityLabel="Nächster Monat"
              className="h-8 w-8 items-center justify-center rounded-full active:bg-white/5"
              onPress={() => shiftMonth(1)}
            >
              <ChevronRight color="#A1A1AA" size={16} />
            </Pressable>
          </View>

          <View className="flex-row">
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} className="flex-1 text-center text-[10px] font-medium text-text-secondary">
                {label}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {buildMonthGrid(viewedMonth.year, viewedMonth.month).map((cell) => {
              const isSelected = cell.key === selectedDate;
              const isCellToday = cell.key === todayKey();
              return (
                <Pressable
                  key={cell.key}
                  className="w-[14.28%] items-center py-1"
                  onPress={() => selectDate(cell.key)}
                >
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-full ${
                      isSelected ? 'bg-primary' : isCellToday ? 'bg-primary/10' : ''
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        isSelected
                          ? 'font-bold text-white'
                          : !cell.inMonth
                            ? 'text-white/20'
                            : isCellToday
                              ? 'font-semibold text-primary'
                              : 'text-text-secondary'
                      }`}
                    >
                      {cell.day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
