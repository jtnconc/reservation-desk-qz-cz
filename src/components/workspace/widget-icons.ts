import {
  BarChart3,
  BellRing,
  Bookmark,
  Briefcase,
  CalendarDays,
  CircleCheck,
  Coffee,
  Info,
  Key,
  MapPin,
  Phone,
  Plane,
  StickyNote,
  Users,
} from "lucide-react";
import type { WidgetIconName, WidgetType } from "@/workspace/types";

/** Small curated icon set available for widget customization. */
export const WIDGET_ICONS: Record<WidgetIconName, typeof Info> = {
  bell: BellRing,
  check: CircleCheck,
  note: StickyNote,
  info: Info,
  users: Users,
  calendar: CalendarDays,
  phone: Phone,
  plane: Plane,
  key: Key,
  pin: MapPin,
  coffee: Coffee,
  briefcase: Briefcase,
  bookmark: Bookmark,
  chart: BarChart3,
};

export const WIDGET_ICON_NAMES = Object.keys(WIDGET_ICONS) as WidgetIconName[];

const DEFAULT_BY_TYPE: Record<WidgetType, WidgetIconName> = {
  reminders: "bell",
  contacts: "users",
  notes: "note",
  information: "info",
  tasks: "check",
  stats: "chart",
  sticky: "bookmark",
};

export const widgetIcon = (type: WidgetType, icon?: WidgetIconName) =>
  WIDGET_ICONS[icon ?? DEFAULT_BY_TYPE[type]] ?? WIDGET_ICONS[DEFAULT_BY_TYPE[type]];
