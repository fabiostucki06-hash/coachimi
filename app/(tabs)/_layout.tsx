import { BookOpen, CalendarSync, ChartColumn, Dumbbell, User, Users } from 'lucide-react-native';
import { Link, Tabs, usePathname } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ThemeToggle } from '@/components/features/ThemeToggle';
import { Logo } from '@/components/ui/Logo';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useResolvedColorScheme } from '@/hooks/useResolvedColorScheme';

const ACTIVE_COLOR = '#6366F1';

// The single hardcoded `#A1A1AA` inactive-icon gray reads fine against the dark
// palette's near-black surface, but falls to a ~2.4:1 contrast ratio against Light
// mode's near-white one - swapping to a darker slate keeps both nav bars legible
// without needing a full design-token pass for every literal icon `color` prop.
function useInactiveNavColor(): string {
  const scheme = useResolvedColorScheme();
  return scheme === 'light' ? '#64748B' : '#A1A1AA';
}

type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>['tabBar']>;
type TabBarProps = Parameters<TabBarRenderer>[0];

const SIDEBAR_LINKS = [
  { href: '/', label: 'Tagebuch', Icon: BookOpen },
  { href: '/training', label: 'Training', Icon: Dumbbell },
  { href: '/cycles', label: 'Zyklen', Icon: CalendarSync },
  { href: '/statistik', label: 'Statistik', Icon: ChartColumn },
  { href: '/friends', label: 'Freunde', Icon: Users },
  { href: '/profil', label: 'Profil', Icon: User },
] as const;

function TabIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  return (
    <View
      className={`items-center justify-center rounded-full px-4 py-1.5 transition-colors duration-200 ease-in-out ${
        focused ? 'bg-primary/10' : 'bg-transparent'
      }`}
    >
      {children}
    </View>
  );
}

// Static sidebar rendered as a real flex sibling of the Tabs content (see
// TabsLayout below), not as an overlay via the `tabBar` render prop — that
// used to be `absolute`-positioned on top of the screen content and only
// avoided covering it because each screen separately hardcoded a matching
// `lg:pl-64` offset. The two numbers drifted (sidebar was `w-56`, padding
// was `pl-64`) and any screen that forgot the padding got covered outright.
function DesktopSidebar() {
  const pathname = usePathname();
  const inactiveColor = useInactiveNavColor();

  return (
    <View className="w-64 shrink-0 gap-1 border-r border-surface-border bg-surface p-4 shadow-xl shadow-black/40 backdrop-blur-xl">
      <Logo className="mb-4 px-2 pt-1" />
      {SIDEBAR_LINKS.map(({ href, label, Icon }) => {
        const isFocused = pathname === href;
        return (
          <Link key={href} href={href} asChild>
            <Pressable
              className={`flex-row items-center gap-3 rounded-2xl px-4 py-3 transition-colors duration-150 ease-in-out ${
                isFocused ? 'bg-primary/10' : 'active:bg-overlay/5'
              }`}
            >
              <Icon color={isFocused ? ACTIVE_COLOR : inactiveColor} size={20} />
              <Text
                className={`text-sm font-semibold ${isFocused ? 'text-primary' : 'text-text-secondary'}`}
              >
                {label}
              </Text>
            </Pressable>
          </Link>
        );
      })}

      <View className="mt-auto gap-2 border-t border-surface-border pt-3">
        <Text className="px-1 text-xs font-semibold text-text-secondary">Darstellung</Text>
        <ThemeToggle />
      </View>
    </View>
  );
}

// Bottom tab bar used on phones/tablets below the `lg` breakpoint. Its
// `absolute` positioning is fine here — it's meant to float over scrollable
// content, and every screen already reserves bottom padding (`pb-32`) for it.
function MobileTabBar({ state, descriptors, navigation }: TabBarProps) {
  const inactiveColor = useInactiveNavColor();
  const items = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    const label = typeof options.title === 'string' ? options.title : route.name;
    const color = isFocused ? ACTIVE_COLOR : inactiveColor;
    const icon = options.tabBarIcon?.({ color, size: 24, focused: isFocused });

    function onPress() {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
    }

    return { key: route.key, label, isFocused, icon, onPress };
  });

  return (
    <View className="absolute bottom-4 left-4 right-4">
      <View
        className="h-[68px] flex-row items-center overflow-hidden rounded-[28px] border border-surface-border bg-surface px-1 backdrop-blur-xl"
        style={{
          shadowColor: '#000000',
          shadowOpacity: 0.4,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
        }}
      >
        {items.map((item) => (
          <Pressable key={item.key} onPress={item.onPress} className="flex-1 items-center justify-center gap-0.5">
            <TabIcon focused={item.isFocused}>{item.icon}</TabIcon>
            <Text
              className={`text-[11px] font-medium ${item.isFocused ? 'text-primary' : 'text-text-secondary'}`}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const isDesktop = useIsDesktop();

  const tabs = (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={isDesktop ? () => null : (props) => <MobileTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tagebuch',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cycles"
        options={{
          title: 'Zyklen',
          tabBarIcon: ({ color, size }) => <CalendarSync color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="statistik"
        options={{
          title: 'Statistik',
          tabBarIcon: ({ color, size }) => <ChartColumn color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Freunde',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );

  if (!isDesktop) return tabs;

  return (
    <View className="flex-1 flex-row">
      <DesktopSidebar />
      <View className="flex-1 overflow-y-auto">{tabs}</View>
    </View>
  );
}
