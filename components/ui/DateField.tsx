import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { todayKey } from '@/store/diaryStore';
import { buildMonthGrid, formatDateShort, monthYearOf, WEEKDAY_LABELS } from '@/utils/calendarDates';

interface DateFieldProps {
  label?: string;
  value: string;
  onChange: (dateKey: string) => void;
}

// Compact "tap to open a month grid" date picker, for forms that need to
// pick one arbitrary past/future date (e.g. logging a weight entry)
// rather than the always-visible day-strip DateSelector uses.
export function DateField({ label, value, onChange }: DateFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewedMonth, setViewedMonth] = useState(() => monthYearOf(value));

  function open() {
    setViewedMonth(monthYearOf(value));
    setExpanded((prev) => !prev);
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
    <View className="gap-1.5">
      {label && <Text className="text-xs font-medium tracking-tight text-text-secondary">{label}</Text>}
      <Pressable
        onPress={open}
        className="flex-row items-center gap-2 rounded-2xl border border-surface-border bg-overlay/5 px-5 py-3.5"
      >
        <Calendar color="#6366F1" size={16} />
        <Text className="text-base text-foreground">{formatDateShort(value)}</Text>
      </Pressable>

      {expanded && (
        <View className="gap-3 rounded-2xl border border-surface-border bg-surface p-3 shadow-md shadow-black/20 backdrop-blur-xl">
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityLabel="Vorheriger Monat"
              className="h-8 w-8 items-center justify-center rounded-full active:bg-overlay/5"
              onPress={() => shiftMonth(-1)}
            >
              <ChevronLeft color="#A1A1AA" size={16} />
            </Pressable>
            <Text className="text-xs font-semibold capitalize text-text-secondary">{monthLabel}</Text>
            <Pressable
              accessibilityLabel="Nächster Monat"
              className="h-8 w-8 items-center justify-center rounded-full active:bg-overlay/5"
              onPress={() => shiftMonth(1)}
            >
              <ChevronRight color="#A1A1AA" size={16} />
            </Pressable>
          </View>

          <View className="flex-row">
            {WEEKDAY_LABELS.map((day) => (
              <Text key={day} className="flex-1 text-center text-[10px] font-medium text-text-secondary">
                {day}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {buildMonthGrid(viewedMonth.year, viewedMonth.month).map((cell) => {
              const isSelected = cell.key === value;
              const isCellToday = cell.key === todayKey();
              return (
                <Pressable
                  key={cell.key}
                  className="w-[14.28%] items-center py-1"
                  onPress={() => {
                    onChange(cell.key);
                    setExpanded(false);
                  }}
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
                            ? 'text-foreground/20'
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
