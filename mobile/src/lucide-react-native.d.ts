declare module 'lucide-react-native' {
  import React from 'react';

  export type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

  export const MapPin: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const Briefcase: LucideIcon;
  export const GraduationCap: LucideIcon;
  export const Send: LucideIcon;
  export const Building2: LucideIcon;
  export const DollarSign: LucideIcon;
  export const Clock: LucideIcon;
}
