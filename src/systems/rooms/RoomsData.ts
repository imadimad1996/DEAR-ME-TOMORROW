import roomsRaw from '../../data/rooms.json';

export interface RoomStyleAssets {
  classic_before: string;
  classic_after: string;
  modern_before: string;
  modern_after: string;
  future_before: string;
  future_after: string;
}

export interface RoomEntry {
  id: string;
  name: string;
  styles: RoomStyleAssets;
}

export const ROOMS_DATA = roomsRaw as RoomEntry[];
