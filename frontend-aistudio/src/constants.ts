import React from 'react';

export interface Plant {
  id: string;
  name: string;
  scientificName: string;
  family: string;
  description: string;
  image: string;
  category: string;
  savedDate?: string;
}

export const POPULAR_PLANTS: Plant[] = [
  {
    id: '1',
    name: '龟背竹',
    scientificName: 'Monstera deliciosa',
    family: 'Araceae',
    description: '天南星科植物，因叶片巨大且具有孔裂如龟甲而得名，是现代植物学研究的热带标志性物种。',
    image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=800',
    category: 'Tropical'
  },
  {
    id: '2',
    name: '银杏',
    scientificName: 'Ginkgo biloba',
    family: 'Ginkgoaceae',
    description: '现存种子植物中最古老的孑遗植物，被称为“活化石”。',
    image: 'https://images.unsplash.com/photo-1508349167430-309603099951?auto=format&fit=crop&q=80&w=800',
    category: 'Temperate'
  },
  {
    id: '3',
    name: '拟石莲花属',
    scientificName: 'Echeveria',
    family: 'Crassulaceae',
    description: '景天科下的一个属，以其紧凑的莲座型叶丛而著称。',
    image: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e59?auto=format&fit=crop&q=80&w=800',
    category: 'Arid'
  },
  {
    id: '4',
    name: '红枫',
    scientificName: 'Acer palmatum',
    family: 'Sapindaceae',
    description: '著名的观叶树种，叶片在秋季呈现深红色，具有极高的园艺观赏价值。',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800',
    category: 'Temperate'
  }
];

export const RECENTLY_SAVED: Plant[] = [
  POPULAR_PLANTS[0],
  POPULAR_PLANTS[3],
  POPULAR_PLANTS[2]
];
