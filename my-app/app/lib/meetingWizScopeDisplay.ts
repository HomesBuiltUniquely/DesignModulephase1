import type {
  ConfigScopeReferenceFile,
  ConfigScopeRoom,
  ConfigScopeSummary,
  LeadshipTypes,
} from '@/app/Components/Types/Types';

export type MeetingWizScopeRoomCard = {
  key: string;
  icon: string;
  iconBg: string;
  title: string;
  coreTheme: string;
  tags: string[];
  notes: string | null;
};

export type MeetingWizScopeReference = {
  key: string;
  label: string;
  viewUrl: string | null;
  isImage: boolean;
};

export type MeetingWizScopeDisplay = {
  roomCards: MeetingWizScopeRoomCard[];
  references: MeetingWizScopeReference[];
  aestheticNotes: string | null;
  hasScopeData: boolean;
};

const ROOM_PALETTE = [
  { icon: '🌿', iconBg: '#f0fdf4' },
  { icon: '🟡', iconBg: '#fefce8' },
  { icon: '🛋️', iconBg: '#eff6ff' },
  { icon: '🍳', iconBg: '#fff7ed' },
  { icon: '🛏️', iconBg: '#faf5ff' },
];

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function roomUnitsTags(room: ConfigScopeRoom): string[] {
  if (room.unitsRequired?.length) {
    return room.unitsRequired.map((u) => String(u).trim()).filter(Boolean);
  }
  const selected = (room.units ?? [])
    .filter((u) => u.selected !== false && u.label?.trim())
    .map((u) => u.label!.trim());
  if (selected.length) return selected;
  const all = (room.units ?? []).map((u) => u.label?.trim()).filter(Boolean) as string[];
  return all;
}

function roomCoreTheme(
  scope: ConfigScopeSummary | null,
  roomName: string,
  leadNotes: string | null,
): string {
  const parts: string[] = [];
  const lower = roomName.toLowerCase();

  const style = trimOrNull(scope?.designStylePreference);
  if (style) parts.push(style);

  if (lower.includes('kitchen')) {
    const layout = trimOrNull(scope?.kitchenLayout);
    if (layout) parts.push(layout);
  }

  const finish = trimOrNull(scope?.materialFinish);
  if (finish) parts.push(finish);

  if (parts.length) return parts.join(', ');

  const understanding =
    trimOrNull(scope?.projectUnderstanding) || trimOrNull(scope?.familySizeDetails);
  if (understanding) return understanding;

  if (leadNotes) return leadNotes;
  return '—';
}

function paletteForIndex(index: number) {
  return ROOM_PALETTE[index % ROOM_PALETTE.length];
}

function buildRoomCard(
  scope: ConfigScopeSummary | null,
  room: ConfigScopeRoom,
  index: number,
  leadNotes: string | null,
): MeetingWizScopeRoomCard {
  const title = trimOrNull(room.roomName) || `Room ${index + 1}`;
  const tags = roomUnitsTags(room);
  if (room.falseCeilingRequired) tags.push('False Ceiling Required');

  const palette = paletteForIndex(index);
  const notes = trimOrNull(room.notes);
  const theme = trimOrNull(room.theme) || roomCoreTheme(scope, title, leadNotes);

  return {
    key: `${title}-${index}`,
    icon: palette.icon,
    iconBg: palette.iconBg,
    title,
    coreTheme: theme,
    tags: tags.length ? tags : ['—'],
    notes: notes ? `"${notes}"` : null,
  };
}

function isImageReference(ref: ConfigScopeReferenceFile): boolean {
  const mime = (ref.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const hint = `${ref.viewUrl || ''} ${ref.fileName || ''}`;
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(hint);
}

export function getMeetingWizScopeDisplay(
  lead: LeadshipTypes | null | undefined,
): MeetingWizScopeDisplay {
  const scope = lead?.configScopeSummary ?? null;
  const leadNotes = trimOrNull(lead?.intakeNotes);
  const rooms = scope?.selectedRooms ?? [];
  const fallbackNames = scope?.selectedRoomNames ?? [];

  let roomCards: MeetingWizScopeRoomCard[] = [];

  if (rooms.length) {
    roomCards = rooms.map((room, index) => buildRoomCard(scope, room, index, leadNotes));
  } else if (fallbackNames.length) {
    roomCards = fallbackNames.map((name, index) => {
      const title = String(name).trim() || `Room ${index + 1}`;
      const palette = paletteForIndex(index);
      return {
        key: `${title}-${index}`,
        icon: palette.icon,
        iconBg: palette.iconBg,
        title,
        coreTheme: roomCoreTheme(scope, title, leadNotes),
        tags: ['—'],
        notes: null,
      };
    });
  } else if (scope || leadNotes) {
    const config = trimOrNull(lead?.intakeConfiguration);
    roomCards = [
      {
        key: 'summary',
        icon: '🏠',
        iconBg: '#f3f4f6',
        title: config || 'Project scope',
        coreTheme: roomCoreTheme(scope, config || 'project', leadNotes),
        tags: scope?.miscAddOns?.length ? [...scope.miscAddOns] : ['—'],
        notes: leadNotes ? `"${leadNotes}"` : null,
      },
    ];
  }

  const refs = scope?.referenceInspiration?.references ?? [];
  const references: MeetingWizScopeReference[] = refs.map((ref, index) => ({
    key: String(ref.id || ref.fileName || `ref-${index}`),
    label: trimOrNull(ref.fileName) || 'Reference',
    viewUrl: trimOrNull(ref.viewUrl),
    isImage: isImageReference(ref),
  }));

  const aestheticNotes =
    trimOrNull(scope?.referenceInspiration?.aestheticNotes) ||
    trimOrNull(scope?.designHandoffNotes) ||
    leadNotes;

  const hasScopeData =
    roomCards.length > 0 ||
    references.length > 0 ||
    Boolean(aestheticNotes && aestheticNotes !== '—');

  return {
    roomCards,
    references,
    aestheticNotes,
    hasScopeData,
  };
}
