export interface User {
  id: number;
  username: string;
  name: string;
  district: string;
  range_office: string;
  role: 'admin' | 'officer';
}

export interface Program {
  id?: number;
  program_type: 'school' | 'community' | 'ngo' | 'planting' | 'home_garden';
  officer_id: number;
  date: string;
  description: string;
  latitude: number;
  longitude: number;
  location_name: string;
  district?: string;
  aga_division?: string;
  gn_division?: string;
  plants_count?: number;
  participants: number;
  details: Record<string, any>;
  officer_name?: string;
}

export const PROGRAM_TYPES = {
  school: 'School Awareness',
  community: 'Community Program',
  ngo: 'NGO / Gov Program',
  planting: 'Tree Planting',
  home_garden: 'Home Garden'
};
