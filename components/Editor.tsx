
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Unit, WindowNode, ProfileSystem, Language, Accessory, SplitDirection, UnitShape, ProfileDrawing, NodeType } from '../types';
import Visualizer, { getYCuts, getXCuts, getSegmentsFromCuts } from './Visualizer';
import ThreeDPreview from './ThreeDPreview';
import CrossSection from './CrossSection';
import { INITIAL_ROOT_NODE, GLASS_TYPES, COLOR_GROUPS, KURTOGLU_70T_CATALOG, KURTOGLU_51LS_CATALOG, KURTOGLU_KTR64T_CATALOG } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Save, SplitSquareHorizontal, SplitSquareVertical, Trash2, Layout, Settings2, Ruler, MousePointer2, Undo2, ChevronUp, Wrench, Box, Square, Triangle, Circle, BoxSelect, Monitor, ZoomIn, ZoomOut, Maximize, Layers, Sparkles, Zap, Package, Check, Sun, Moon, Loader2, Camera, Upload, X, Image as ImageIcon, ArrowLeftRight, Copy } from 'lucide-react';
import { t } from '../translations';
import { extractGlassPanes } from '../services/optimizationService';

const compressImageIfNeeded = (file: File): Promise<{ base64: string; type: string }> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          base64: e.target?.result as string,
          type: file.type
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: e.target?.result as string, type: file.type });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as jpeg with 0.82 quality to keep payload small
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        resolve({
          base64: compressedBase64,
          type: 'image/jpeg'
        });
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

interface EditorProps {
  unit?: Unit;
  systems: ProfileSystem[];
  accessories?: Accessory[];
  lang: Language;
  onSave: (unit: Unit) => void;
  onCancel: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

const TYPOLOGIES_LIST = [
  { 
    id: 'fixed_storefront', 
    nameTr: 'Sabit / Vitrin', 
    nameEn: 'Fixed / Storefront',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        {/* Outer frame */}
        <rect x="8" y="8" width="48" height="48" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        {/* Glass bead margin line */}
        <rect x="12" y="12" width="40" height="40" strokeWidth="0.8" strokeDasharray="1 1" opacity="0.4" />
        {/* Technical "+" symbol for fixed glazing */}
        <line x1="32" y1="26" x2="32" y2="38" strokeWidth="1" strokeLinecap="round" />
        <line x1="26" y1="32" x2="38" y2="32" strokeWidth="1" strokeLinecap="round" />
      </svg>
    )
  },
  { 
    id: 'top_hung_window', 
    nameTr: 'Vasistas', 
    nameEn: 'Top Hung',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        {/* Outer frame */}
        <rect x="8" y="8" width="48" height="48" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="12" y="12" width="40" height="40" strokeWidth="0.8" opacity="0.3" />
        {/* Inner Sash Frame */}
        <rect x="14" y="14" width="36" height="36" strokeWidth="1" strokeLinecap="round" />
        {/* Dashed lines pointing to handle side from top-hinge corners */}
        <line x1="14" y1="14" x2="32" y2="50" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="50" y1="14" x2="32" y2="50" strokeWidth="0.8" strokeDasharray="3 2" />
      </svg>
    )
  },
  { 
    id: 'hinged_window', 
    nameTr: 'Tek Açılım', 
    nameEn: 'Side Hung Window',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        {/* Outer frame */}
        <rect x="8" y="8" width="48" height="48" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="12" y="12" width="40" height="40" strokeWidth="0.8" opacity="0.3" />
        <rect x="14" y="14" width="36" height="36" strokeWidth="1" strokeLinecap="round" />
        {/* Hinge is on left, points to right handle */}
        <line x1="14" y1="14" x2="50" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="14" y1="50" x2="50" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
      </svg>
    )
  },
  { 
    id: 'tilt_turn_window', 
    nameTr: 'Çift Açılım', 
    nameEn: 'Tilt & Turn',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        {/* Outer frame */}
        <rect x="8" y="8" width="48" height="48" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="12" y="12" width="40" height="40" strokeWidth="0.8" opacity="0.3" />
        <rect x="14" y="14" width="36" height="36" strokeWidth="1" strokeLinecap="round" />
        {/* Side hung lines */}
        <line x1="14" y1="14" x2="50" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="14" y1="50" x2="50" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        {/* Bottom hung/tilt lines */}
        <line x1="14" y1="50" x2="32" y2="14" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="50" y1="50" x2="32" y2="14" strokeWidth="0.8" strokeDasharray="3 2" />
      </svg>
    )
  },
  { 
    id: 'double_sash_window', 
    nameTr: 'Çift Kanat', 
    nameEn: 'Double Sash',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        {/* Outer frame */}
        <rect x="8" y="8" width="48" height="48" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="12" y="12" width="40" height="40" strokeWidth="0.8" opacity="0.3" />
        {/* Center Partition Column */}
        <line x1="32" y1="8" x2="32" y2="56" strokeWidth="1.5" />
        {/* Left inner sash */}
        <rect x="13" y="13" width="16" height="38" strokeWidth="1" strokeLinecap="round" />
        {/* Right inner sash */}
        <rect x="35" y="13" width="16" height="38" strokeWidth="1" strokeLinecap="round" />
        {/* Left opening lines */}
        <line x1="13" y1="13" x2="29" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="13" y1="51" x2="29" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        {/* Right opening lines */}
        <line x1="51" y1="13" x2="35" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="51" y1="51" x2="35" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
      </svg>
    )
  },
  { 
    id: 'angular_junction', 
    nameTr: 'Açılı Dönüş', 
    nameEn: 'Angular',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        {/* Profile Angled Drawing */}
        <rect x="8" y="14" width="16" height="36" rx="1" strokeWidth="1.2" />
        <rect x="24" y="8" width="12" height="48" rx="1" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="36" y="14" width="16" height="36" rx="1" strokeWidth="1.2" />
        {/* Angle degree arc line */}
        <path d="M 16 52 Q 30 58 44 52" strokeWidth="0.8" strokeDasharray="2 2" />
        <line x1="30" y1="14" x2="30" y2="50" strokeWidth="0.6" strokeDasharray="1 1" opacity="0.5" />
        <line x1="32" y1="20" x2="32" y2="44" strokeWidth="0.6" strokeDasharray="1 1" opacity="0.5" />
      </svg>
    )
  },
  { 
    id: 'inside_opening_door', 
    nameTr: 'İçe Açılır Kapı', 
    nameEn: 'Inside Opening Door',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        {/* Tall outer door frame */}
        <rect x="14" y="6" width="36" height="52" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="17" y="9" width="30" height="46" strokeWidth="0.8" opacity="0.3" />
        {/* Door Sash Panel */}
        <rect x="19" y="11" width="26" height="44" strokeWidth="1.2" strokeLinecap="round" />
        {/* Inward Opening lines */}
        <line x1="19" y1="11" x2="45" y2="33" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="19" y1="55" x2="45" y2="33" strokeWidth="0.8" strokeDasharray="3 2" />
        {/* Handles */}
        <path d="M 42 31 L 40 31 L 40 35 M 42 31.5 L 42 34.5" strokeWidth="1" strokeLinecap="round" />
      </svg>
    )
  },
  { 
    id: 'inside_opening_double_door', 
    nameTr: 'İçe Açılan Çift Kanat Kapı', 
    nameEn: 'Inside double Door',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        <rect x="10" y="6" width="44" height="52" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        {/* Center vertical mullion line */}
        <line x1="32" y1="6" x2="32" y2="58" strokeWidth="1.5" />
        {/* Left inner sash */}
        <rect x="14" y="10" width="15" height="44" strokeWidth="1.2" strokeLinecap="round" />
        {/* Right inner sash */}
        <rect x="35" y="10" width="15" height="44" strokeWidth="1.2" strokeLinecap="round" />
        {/* Left Opening */}
        <line x1="14" y1="10" x2="29" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="14" y1="54" x2="29" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        {/* Right Opening */}
        <line x1="50" y1="10" x2="35" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="50" y1="54" x2="35" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        {/* Handles */}
        <line x1="30" y1="30" x2="30" y2="34" strokeWidth="1" />
        <line x1="34" y1="30" x2="34" y2="34" strokeWidth="1" />
      </svg>
    )
  },
  { 
    id: 'outside_opening_door', 
    nameTr: 'Dışa Açılır Kapı', 
    nameEn: 'Outside Opening Door',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        <rect x="14" y="6" width="36" height="52" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="19" y="11" width="26" height="44" strokeWidth="1.2" strokeLinecap="round" />
        {/* Outward Opening lines */}
        <line x1="45" y1="11" x2="19" y2="33" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="45" y1="55" x2="19" y2="33" strokeWidth="0.8" strokeDasharray="3 2" />
        {/* Handle */}
        <path d="M 22 31 L 24 31 L 24 35" strokeWidth="1" strokeLinecap="round" />
      </svg>
    )
  },
  { 
    id: 'outside_opening_double_door', 
    nameTr: 'Dışa Açılan Çift Kanat Kapı', 
    nameEn: 'Outside double Door',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        <rect x="10" y="6" width="44" height="52" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="6" x2="32" y2="58" strokeWidth="1.5" />
        <rect x="14" y="10" width="15" height="44" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="35" y="10" width="15" height="44" strokeWidth="1.2" strokeLinecap="round" />
        {/* Outward hinges */}
        <line x1="29" y1="10" x2="14" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="29" y1="54" x2="14" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="35" y1="10" x2="50" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
        <line x1="35" y1="54" x2="50" y2="32" strokeWidth="0.8" strokeDasharray="3 2" />
      </svg>
    )
  },
  { 
    id: 'pivot_opening', 
    nameTr: 'Pivot Açılım', 
    nameEn: 'Pivot Opening',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        <rect x="8" y="8" width="48" height="48" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="12" y="12" width="40" height="40" strokeWidth="0.8" opacity="0.3" />
        <rect x="14" y="14" width="36" height="36" strokeWidth="1.2" strokeLinecap="round" />
        {/* Central vertical rotation axis */}
        <line x1="32" y1="6" x2="32" y2="58" strokeWidth="0.8" strokeDasharray="4 2" />
        {/* Axis center dot indicators */}
        <circle cx="32" cy="14" r="2.5" fill="currentColor" />
        <circle cx="32" cy="50" r="2.5" fill="currentColor" />
        {/* Pivot diagonal dashed vectors showing sweep */}
        <line x1="14" y1="32" x2="32" y2="14" strokeWidth="0.8" strokeDasharray="2 2" />
        <line x1="14" y1="32" x2="32" y2="50" strokeWidth="0.8" strokeDasharray="2 2" />
        <line x1="50" y1="32" x2="32" y2="14" strokeWidth="0.8" strokeDasharray="2 2" />
        <line x1="50" y1="32" x2="32" y2="50" strokeWidth="0.8" strokeDasharray="2 2" />
      </svg>
    )
  },
  { 
    id: 'sliding_window', 
    nameTr: 'Sürme Pencere', 
    nameEn: 'Sliding Window',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        <rect x="8" y="14" width="48" height="36" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        {/* Sashes split */}
        <line x1="32" y1="14" x2="32" y2="50" strokeWidth="1.2" />
        {/* Left inner sash */}
        <rect x="12" y="18" width="18" height="28" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        {/* Right inner sash */}
        <rect x="34" y="18" width="18" height="28" strokeWidth="1.2" strokeLinecap="round" />
        {/* Sliding arrows */}
        <line x1="16" y1="32" x2="26" y2="32" strokeWidth="1" />
        <path d="M 22 28 L 26 32 L 22 36" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="48" y1="32" x2="38" y2="32" strokeWidth="1" />
        <path d="M 42 28 L 38 32 L 42 36" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  { 
    id: 'sliding_door', 
    nameTr: 'Sürme Kapı', 
    nameEn: 'Sliding Door',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        <rect x="12" y="6" width="40" height="52" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        {/* Center vertical mullion line */}
        <line x1="32" y1="6" x2="32" y2="58" strokeWidth="1.5" />
        {/* Left tall sash */}
        <rect x="15" y="10" width="14" height="44" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        {/* Right tall sash */}
        <rect x="35" y="10" width="14" height="44" strokeWidth="1.2" strokeLinecap="round" />
        {/* Sliding arrows */}
        <line x1="18" y1="32" x2="26" y2="32" strokeWidth="1" />
        <path d="M 22 28 L 26 32 L 22 36" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="46" y1="32" x2="38" y2="32" strokeWidth="1" />
        <path d="M 42 28 L 38 32 L 42 36" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  { 
    id: 'tilt_slide_door', 
    nameTr: 'Paralel Sürme', 
    nameEn: 'Tilt & Slide Opening Door',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        <rect x="8" y="12" width="48" height="40" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        {/* Middle split */}
        <line x1="32" y1="12" x2="32" y2="52" strokeWidth="1.5" />
        {/* Left Fixed sash */}
        <rect x="12" y="16" width="16" height="32" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        <line x1="20" y1="28" x2="20" y2="36" strokeWidth="0.8" />
        <line x1="16" y1="32" x2="24" y2="32" strokeWidth="0.8" />
        {/* Right sliding and tilt sash */}
        <rect x="36" y="16" width="16" height="32" strokeWidth="1.2" strokeLinecap="round" className="stroke-blue-400/80" />
        {/* Translation sliding arrow */}
        <line x1="52" y1="32" x2="36" y2="32" strokeWidth="1.2" />
        <path d="M 40 28 L 36 32 L 40 36" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Tilt action dashed line */}
        <line x1="36" y1="48" x2="44" y2="16" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.75" />
        <line x1="52" y1="48" x2="44" y2="16" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.75" />
      </svg>
    )
  },
  { 
    id: 'folding_door', 
    nameTr: 'Katlanır Kapı', 
    nameEn: 'Folding Door',
    renderIcon: (active: boolean) => (
      <svg className={`w-12 h-12 stroke-current ${active ? 'text-blue-400' : 'text-slate-400'} transition-colors`} viewBox="0 0 64 64" fill="none">
        <rect x="8" y="10" width="48" height="44" rx="1.5" strokeWidth="1.5" strokeLinecap="round" />
        {/* Accordion Panels */}
        <line x1="20" y1="10" x2="20" y2="54" strokeWidth="1" />
        <line x1="32" y1="10" x2="32" y2="54" strokeWidth="1" />
        <line x1="44" y1="10" x2="44" y2="54" strokeWidth="1" />
        {/* Zigzag dashed folding trajectory */}
        <path d="M 8 50 L 20 14 L 32 50 L 44 14 L 56 50" strokeWidth="0.8" strokeDasharray="3 2" />
        {/* Small hinge round nodes */}
        <circle cx="20" cy="14" r="1.5" fill="currentColor" />
        <circle cx="32" cy="50" r="1.5" fill="currentColor" />
        <circle cx="44" cy="14" r="1.5" fill="currentColor" />
      </svg>
    )
  }
];

const getInitialNodeForTypology = (typologyId: string): WindowNode => {
  const rootId = uuidv4();
  switch (typologyId) {
    case 'fixed_storefront':
      return {
        id: rootId,
        type: 'glass',
        openingType: 'fixed',
      };
    
    case 'top_hung_window':
      return {
        id: rootId,
        type: 'glass',
        openingType: 'tilt',
      };
      
    case 'hinged_window':
      return {
        id: rootId,
        type: 'glass',
        openingType: 'turn-left',
      };
      
    case 'tilt_turn_window':
      return {
        id: rootId,
        type: 'glass',
        openingType: 'tilt-turn-left',
      };
      
    case 'double_sash_window':
      return {
        id: rootId,
        type: 'container',
        direction: 'vertical',
        splitRatio: [0.5, 0.5],
        children: [
          { id: uuidv4(), type: 'glass', openingType: 'turn-left' },
          { id: uuidv4(), type: 'glass', openingType: 'tilt-turn-right' }
        ]
      };
      
    case 'angular_junction':
      return {
        id: rootId,
        type: 'container',
        direction: 'vertical',
        splitRatio: [0.5, 0.5],
        children: [
          { id: uuidv4(), type: 'glass', openingType: 'fixed' },
          { id: uuidv4(), type: 'glass', openingType: 'fixed' }
        ]
      };
      
    case 'inside_opening_door':
      return {
        id: rootId,
        type: 'glass',
        openingType: 'turn-right',
      };
      
    case 'inside_opening_double_door':
      return {
        id: rootId,
        type: 'container',
        direction: 'vertical',
        splitRatio: [0.5, 0.5],
        children: [
          { id: uuidv4(), type: 'glass', openingType: 'turn-left' },
          { id: uuidv4(), type: 'glass', openingType: 'turn-right' }
        ]
      };
      
    case 'outside_opening_door':
      return {
        id: rootId,
        type: 'glass',
        openingType: 'turn-left',
      };
      
    case 'outside_opening_double_door':
      return {
        id: rootId,
        type: 'container',
        direction: 'vertical',
        splitRatio: [0.5, 0.5],
        children: [
          { id: uuidv4(), type: 'glass', openingType: 'turn-left' },
          { id: uuidv4(), type: 'glass', openingType: 'turn-right' }
        ]
      };
      
    case 'pivot_opening':
      return {
        id: rootId,
        type: 'glass',
        openingType: 'tilt',
      };
      
    case 'sliding_window':
    case 'sliding_door':
      return {
        id: rootId,
        type: 'container',
        direction: 'vertical',
        splitRatio: [0.5, 0.5],
        children: [
          { id: uuidv4(), type: 'glass', openingType: 'sliding' },
          { id: uuidv4(), type: 'glass', openingType: 'fixed' }
        ]
      };
      
    case 'tilt_slide_door':
      return {
        id: rootId,
        type: 'container',
        direction: 'vertical',
        splitRatio: [0.5, 0.5],
        children: [
          { id: uuidv4(), type: 'glass', openingType: 'fixed' },
          { id: uuidv4(), type: 'glass', openingType: 'sliding' }
        ]
      };
      
    case 'folding_door':
      return {
        id: rootId,
        type: 'container',
        direction: 'vertical',
        splitRatio: [0.33, 0.67],
        children: [
          { id: uuidv4(), type: 'glass', openingType: 'turn-left' },
          { 
            id: uuidv4(), 
            type: 'container', 
            direction: 'vertical', 
            splitRatio: [0.5, 0.5], 
            children: [
              { id: uuidv4(), type: 'glass', openingType: 'turn-left' },
              { id: uuidv4(), type: 'glass', openingType: 'turn-left' }
            ]
          }
        ]
      };
      
    default:
      return {
        id: rootId,
        type: 'glass',
        openingType: 'fixed',
      };
  }
};

const ProfileCadDrawing: React.FC<{ 
  code: string; 
  type: 'frame' | 'sash' | 'mullion'; 
  systemDrawings?: ProfileDrawing[];
}> = ({ code, type, systemDrawings }) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const isThermal = code.includes('TH');

  React.useEffect(() => {
    setImageFailed(false);
  }, [code]);

  // Check if there is an uploaded image in localStorage for this specific profile code
  const localUploadedImage = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('alumetric_custom_profile_images');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[code]) return parsed[code];
        
        const norm = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/70th/, '70t');
        const targetNorm = norm(code);
        const matchedKey = Object.keys(parsed).find(k => norm(k) === targetNorm);
        if (matchedKey) return parsed[matchedKey];
      }
    } catch (e) {
      console.warn(e);
    }
    return '';
  }, [code]);

  // Check in the system profile drawings library configured in Settings
  const systemUploadedImage = React.useMemo(() => {
    if (!systemDrawings) return '';
    const norm = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/70th/, '70t');
    const targetNorm = norm(code);
    const found = systemDrawings.find(d => norm(d.code) === targetNorm);
    if (found) {
      return found.crossSectionUrl || found.planSectionUrl || '';
    }
    return '';
  }, [code, systemDrawings]);

  // If we have an uploaded image, or if we try to load the static image in repository under /profiles/[code].png
  const src = localUploadedImage || systemUploadedImage || `/profiles/${code}.png`;

  if (!imageFailed && src) {
    return (
      <img
        src={src}
        alt={code}
        onError={() => setImageFailed(true)}
        className="w-14 h-14 object-contain bg-white rounded-xl border border-slate-750 p-1 shrink-0 shadow-inner"
        referrerPolicy="no-referrer"
      />
    );
  }

  if (type === 'frame') {
    return (
      <svg className="w-14 h-14 text-sky-400 stroke-current bg-slate-950 border border-slate-800 p-1 rounded-xl shrink-0" viewBox="0 0 100 100" fill="none">
        {/* Background Grid Lines for CAD feel */}
        <line x1="10" y1="50" x2="90" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="50" y1="10" x2="50" y2="90" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
        
        {isThermal ? (
          <>
            {/* Outer Chamber (Left Side) */}
            <path d="M 12 78 L 36 78 L 36 28 L 22 28 L 22 40 L 12 40 Z" strokeWidth="1.5" strokeLinejoin="miter" />
            <path d="M 18 78 L 18 45" strokeWidth="0.8" strokeOpacity="0.5" />
            
            {/* Inner Chamber (Right Side with rebate) */}
            <path d="M 64 78 L 88 78 L 88 18 L 76 18 L 76 42 L 64 42 Z" strokeWidth="1.5" strokeLinejoin="miter" />
            <path d="M 82 78 L 82 30" strokeWidth="0.8" strokeOpacity="0.5" />
            <path d="M 76 42 L 88 42" strokeWidth="0.8" strokeOpacity="0.5" strokeDasharray="2 1" />
            
            {/* Polyamide Thermal Break Bars */}
            <g className="text-amber-500">
              {/* Upper polyamide bar */}
              <path d="M 36 34 L 64 34" strokeWidth="2" strokeLinecap="square" />
              {/* Lower polyamide bar */}
              <path d="M 36 70 L 64 70" strokeWidth="2" strokeLinecap="square" />
              {/* Inter-bar insulation core */}
              <rect x="36.5" y="38" width="27" height="28" fill="#f97316" fillOpacity="0.1" stroke="#f97316" strokeWidth="0.8" strokeDasharray="1 1.5" />
              <text x="50" y="54" fill="#f97316" fontSize="5" fontWeight="bold" textAnchor="middle" stroke="none" letterSpacing="0.5">THERMAL</text>
            </g>
          </>
        ) : (
          <>
            {/* Non-Thermal Solid Multi-Chamber Frame */}
            <path d="M 15 78 L 85 78 L 85 18 L 72 18 L 72 40 L 15 40 Z" strokeWidth="1.5" strokeLinejoin="miter" />
            {/* Inner Chambers division lines */}
            <line x1="15" y1="58" x2="85" y2="58" strokeWidth="1" strokeOpacity="0.7" />
            <line x1="50" y1="40" x2="50" y2="78" strokeWidth="1" strokeOpacity="0.7" />
            <line x1="72" y1="18" x2="72" y2="40" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="1 1" />
            {/* Screw Ports & Details */}
            <circle cx="32" cy="49" r="2.5" strokeWidth="0.8" strokeOpacity="0.8" />
            <circle cx="68" cy="49" r="2.5" strokeWidth="0.8" strokeOpacity="0.8" />
          </>
        )}
        
        {/* CAD Dimension tick marks in corner for extra blueprint feeling */}
        <path d="M 8 8 L 14 8 M 8 8 L 8 14" stroke="#475569" strokeWidth="0.8" />
        <path d="M 92 92 L 86 92 M 92 92 L 92 86" stroke="#475569" strokeWidth="0.8" />
      </svg>
    );
  }
  
  if (type === 'sash') {
    return (
      <svg className="w-14 h-14 text-orange-400 stroke-current bg-slate-950 border border-slate-800 p-1 rounded-xl shrink-0" viewBox="0 0 100 100" fill="none">
        {/* Background Grid Lines for CAD feel */}
        <line x1="10" y1="50" x2="90" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="50" y1="10" x2="50" y2="90" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
        
        {isThermal ? (
          <>
            {/* Outer Chamber (Left Half facing outside) */}
            {/* Z-shape step overlay */}
            <path d="M 12 28 L 36 28 L 36 78 L 24 78 L 24 44 L 12 44 Z" strokeWidth="1.5" strokeLinejoin="miter" />
            <line x1="24" y1="28" x2="24" y2="44" strokeWidth="0.8" strokeOpacity="0.5" />
            
            {/* Inner Chamber (Right Half facing inside with Eurogroove) */}
            <path d="M 64 28 L 88 28 L 88 44 L 76 44 L 76 78 L 64 78 Z" strokeWidth="1.5" strokeLinejoin="miter" />
            {/* Eurogroove C-channel detail */}
            <path d="M 88 34 L 82 34 L 82 38 L 88 38" strokeWidth="1" strokeOpacity="0.8" />
            
            {/* Polyamide Thermal Break Bars */}
            <g className="text-amber-500">
              <path d="M 36 34 L 64 34" strokeWidth="2" strokeLinecap="square" />
              <path d="M 36 70 L 64 70" strokeWidth="2" strokeLinecap="square" />
              <rect x="36.5" y="38" width="27" height="28" fill="#f97316" fillOpacity="0.1" stroke="#f97316" strokeWidth="0.8" strokeDasharray="1 1.5" />
              <text x="50" y="54" fill="#f97316" fontSize="5" fontWeight="bold" textAnchor="middle" stroke="none" letterSpacing="0.5">THERMAL</text>
            </g>
          </>
        ) : (
          <>
            {/* Non-Thermal Sash with step rebate and glazing pocket */}
            <path d="M 15 28 L 85 28 L 85 45 L 72 45 L 72 78 L 15 78 Z" strokeWidth="1.5" strokeLinejoin="miter" />
            {/* Eurogroove detail */}
            <path d="M 85 34 L 79 34 L 79 38 L 85 38" strokeWidth="1" strokeOpacity="0.8" />
            {/* Inner chamber lines */}
            <line x1="15" y1="52" x2="72" y2="52" strokeWidth="1" strokeOpacity="0.7" />
            <line x1="42" y1="28" x2="42" y2="78" strokeWidth="1" strokeOpacity="0.7" />
            <circle cx="28" cy="40" r="2.5" strokeWidth="0.8" strokeOpacity="0.8" />
          </>
        )}
        
        {/* CAD Dimension tick marks */}
        <path d="M 8 8 L 14 8 M 8 8 L 8 14" stroke="#475569" strokeWidth="0.8" />
        <path d="M 92 92 L 86 92 M 92 92 L 92 86" stroke="#475569" strokeWidth="0.8" />
      </svg>
    );
  }
  
  return (
    <svg className="w-14 h-14 text-emerald-400 stroke-current bg-slate-950 border border-slate-800 p-1 rounded-xl shrink-0" viewBox="0 0 100 100" fill="none">
      {/* Background Grid Lines for CAD feel */}
      <line x1="10" y1="50" x2="90" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1="50" y1="10" x2="50" y2="90" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
      
      {isThermal ? (
        <>
          {/* Left Chamber (Outer/Glass Pocket symmetric left) */}
          <path d="M 12 34 L 36 34 L 36 66 L 12 66 Z" strokeWidth="1.5" strokeLinejoin="miter" />
          {/* Screws channel flange */}
          <path d="M 12 42 L 18 42 L 18 58 L 12 58" strokeWidth="1" strokeOpacity="0.8" />
          
          {/* Right Chamber (Inner/Glass Pocket symmetric right) */}
          <path d="M 64 34 L 88 34 L 88 66 L 64 66 Z" strokeWidth="1.5" strokeLinejoin="miter" />
          <path d="M 88 42 L 82 42 L 82 58 L 88 58" strokeWidth="1" strokeOpacity="0.8" />
          
          {/* Polyamide Thermal Break Bars */}
          <g className="text-amber-500">
            <path d="M 36 40 L 64 40" strokeWidth="2" strokeLinecap="square" />
            <path d="M 36 60 L 64 60" strokeWidth="2" strokeLinecap="square" />
            <rect x="36.5" y="42" width="27" height="16" fill="#f97316" fillOpacity="0.1" stroke="#f97316" strokeWidth="0.8" strokeDasharray="1 1.5" />
            <text x="50" y="52" fill="#f97316" fontSize="5" fontWeight="bold" textAnchor="middle" stroke="none" letterSpacing="0.5">THERMAL</text>
          </g>
        </>
      ) : (
        <>
          {/* Non-Thermal T-shaped/I-shaped Symmetric Mullion Section */}
          <path d="M 15 34 L 85 34 L 85 46 L 72 46 L 72 54 L 85 54 L 85 66 L 15 66 L 15 54 L 28 54 L 28 46 L 15 46 Z" strokeWidth="1.5" strokeLinejoin="miter" />
          {/* Inner reinforcing partition webs */}
          <line x1="38" y1="34" x2="38" y2="66" strokeWidth="1" strokeOpacity="0.7" />
          <line x1="62" y1="34" x2="62" y2="66" strokeWidth="1" strokeOpacity="0.7" />
          <line x1="38" y1="50" x2="62" y2="50" strokeWidth="1" strokeOpacity="0.7" />
          <circle cx="50" cy="50" r="3" strokeWidth="0.8" strokeOpacity="0.8" />
        </>
      )}
      
      {/* CAD Dimension tick marks */}
      <path d="M 8 8 L 14 8 M 8 8 L 8 14" stroke="#475569" strokeWidth="0.8" />
      <path d="M 92 92 L 86 92 M 92 92 L 92 86" stroke="#475569" strokeWidth="0.8" />
    </svg>
  );
};

const compressProfileImage = (file: File): Promise<{ base64: string; type: string }> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          base64: e.target?.result as string,
          type: file.type
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 250;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: e.target?.result as string, type: file.type });
          return;
        }

        // Fill background with white to prevent transparent PNGs turning black when compressed to JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
        resolve({
          base64: compressedBase64,
          type: 'image/jpeg'
        });
      };
      img.onerror = (err) => reject(err);
    };
    reader.readAsDataURL(file);
  });
};

const ProfilePreviewAndUpload: React.FC<{
  code: string;
  type: 'frame' | 'sash' | 'mullion';
  imageUrl: string;
  onImageUploaded: (base64: string) => void;
  onImageCleared: () => void;
  lang: 'tr' | 'en';
  systemDrawings?: ProfileDrawing[];
}> = ({ code, type, imageUrl, onImageUploaded, onImageCleared, lang, systemDrawings }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Robust, dynamic static profile asset progressive fallback state
  const [resolvedSrc, setResolvedSrc] = React.useState<string | null>(null);
  const [hasError, setHasError] = React.useState(false);
  const [triedExtensions, setTriedExtensions] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (imageUrl) {
      setResolvedSrc(imageUrl);
      setHasError(false);
    } else {
      const cleanCode = code.trim();
      setResolvedSrc(`/profiles/${cleanCode}.png`);
      setHasError(false);
      setTriedExtensions(['.png']);
    }
  }, [imageUrl, code]);

  const handleImageError = () => {
    if (imageUrl) {
      // The uploaded base64 itself failed to load (extremely unlikely)
      setHasError(true);
      setResolvedSrc(null);
      return;
    }

    const extensions = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG'];
    const currentExtIndex = extensions.findIndex(ext => triedExtensions.includes(ext));
    const nextExtIndex = currentExtIndex + 1;

    if (nextExtIndex < extensions.length) {
      const nextExt = extensions[nextExtIndex];
      setTriedExtensions(prev => [...prev, nextExt]);
      const cleanCode = code.trim();
      setResolvedSrc(`/profiles/${cleanCode}${nextExt}`);
    } else {
      // All static extensions failed, gracefully fall back to vector CAD rendering
      setHasError(true);
      setResolvedSrc(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const res = await compressProfileImage(file);
        onImageUploaded(res.base64);
      } catch (err) {
        console.error('Error compressing uploaded profile image:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            onImageUploaded(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const showImage = resolvedSrc && !hasError;

  return (
    <div className="relative group cursor-pointer shrink-0" onClick={triggerUpload} title={lang === 'tr' ? 'Katalog Kesit Resmi Yükle' : 'Upload Catalog Profile Drawing'}>
      {showImage ? (
        <div className="relative w-14 h-14 bg-white rounded-xl border border-slate-750 p-1 overflow-hidden flex items-center justify-center shadow-lg transition-all hover:border-blue-500">
          <img 
            src={resolvedSrc!} 
            alt={code} 
            onError={handleImageError} 
            className="w-full h-full object-contain transition-transform group-hover:scale-105" 
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
            <span className="text-[9px] font-bold uppercase tracking-wider">{lang === 'tr' ? 'Değiş' : 'Change'}</span>
          </div>
          {imageUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onImageCleared();
              }}
              className="absolute top-0 right-0 w-4 h-4 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center rounded-bl-lg transition-colors border-l border-b border-red-500 z-10 text-[10px] font-bold"
              title={lang === 'tr' ? 'Resmi Kaldır' : 'Remove Image'}
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <ProfileCadDrawing code={code} type={type} systemDrawings={systemDrawings} />
          <div className="absolute inset-0 bg-slate-900/80 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-blue-400 border border-dotted border-blue-500/40">
            <span className="text-[9px] font-bold uppercase tracking-wider">{lang === 'tr' ? 'Resim Ekle' : 'Add Image'}</span>
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

const getNormalizedSystemId = (sysIdOrName: string, systems: ProfileSystem[], frameProfileCode?: string) => {
  if (!systems || systems.length === 0) return 'kurt-51ls';

  if (sysIdOrName && sysIdOrName.trim() !== '') {
    const raw = sysIdOrName.trim();
    const sysLower = raw.toLowerCase();
    
    // 1. Direct ID match
    let found = systems.find(s => s.id === raw) || systems.find(s => s.id.toLowerCase() === sysLower);
    if (found) return found.id;

    // 2. Exact Name match
    found = systems.find(s => s.name === raw) || systems.find(s => s.name.toLowerCase() === sysLower);
    if (found) return found.id;
  }

  // 3. Infer from frame profile code (e.g., "70T-102-18", "51LS-101", "64T-101", etc.)
  if (frameProfileCode) {
    const code = frameProfileCode.toUpperCase();
    if (code.startsWith('64T') || code.startsWith('KTR64') || code.startsWith('64TH')) {
      const found64T = systems.find(s => s.id === 'kurt-ktr-64t' || s.id.includes('64t') || s.name.toUpperCase().includes('64T'));
      if (found64T) return found64T.id;
    }
    if (code.startsWith('70T')) {
      const found70T = systems.find(s => s.id === 'kurt-70t-th' || s.id.includes('70t') || s.name.toUpperCase().includes('70T'));
      if (found70T) return found70T.id;
    }
    if (code.startsWith('51LS') || code.startsWith('51LM') || code.startsWith('58T')) {
      const found51LS = systems.find(s => s.id === 'kurt-51ls' || s.id.includes('51ls') || s.name.toUpperCase().includes('51LS'));
      if (found51LS) return found51LS.id;
    }
  }

  // 4. Substring / Keyword match
  if (sysIdOrName && sysIdOrName.trim() !== '') {
    const raw = sysIdOrName.trim();
    const sysLower = raw.toLowerCase();
    const found = systems.find(s => s.name.toLowerCase().includes(sysLower) || sysLower.includes(s.name.toLowerCase()) ||
                          s.id.toLowerCase().includes(sysLower) || sysLower.includes(s.id.toLowerCase()));
    if (found) return found.id;
  }

  return systems[0]?.id || 'kurt-51ls';
};

export interface NodeBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getNodeBounds(
  root: WindowNode,
  targetId: string,
  rootW: number,
  rootH: number,
  frameW: number = 55
): NodeBounds | null {
  function traverse(node: WindowNode, x: number, y: number, w: number, h: number): NodeBounds | null {
    if (node.id === targetId) {
      return { x, y, w, h };
    }
    if (node.type === 'container' && node.children && node.children.length === 2 && node.splitRatio) {
      const isVert = node.direction === 'vertical';
      const available = isVert ? Math.max(1, w - frameW) : Math.max(1, h - frameW);
      const s1 = available * node.splitRatio[0];
      const span1 = s1 + frameW / 2;
      const span2 = (isVert ? w : h) - span1;

      if (isVert) {
        const left = traverse(node.children[0], x, y, span1, h);
        if (left) return left;
        const right = traverse(node.children[1], x + span1, y, span2, h);
        if (right) return right;
      } else {
        const top = traverse(node.children[0], x, y, w, span1);
        if (top) return top;
        const bottom = traverse(node.children[1], x, y + span1, w, span2);
        if (bottom) return bottom;
      }
    }
    return null;
  }

  return traverse(root, 0, 0, rootW, rootH);
}

const Editor: React.FC<EditorProps> = ({ unit: initialUnit, systems, accessories = [], lang, onSave, onCancel, theme = 'dark', onToggleTheme }) => {
  const [name, setName] = useState(initialUnit?.name || t(lang, 'newPosition'));
  const [width, setWidth] = useState(initialUnit?.width || 1200);
  const [height, setHeight] = useState(initialUnit?.height || 1500);
  const [quantity, setQuantity] = useState(initialUnit?.quantity || 1);
  const [shape, setShape] = useState<UnitShape>(initialUnit?.shape || 'rect');
  const [archHeight, setArchHeight] = useState(initialUnit?.archHeight || 400);
  const [viewPerspective, setViewPerspective] = useState<'interior' | 'exterior'>(initialUnit?.viewPerspective || 'interior');
  const [systemId, setSystemId] = useState(() => getNormalizedSystemId(initialUnit?.system || '', systems, initialUnit?.selectedFrameProfile));
  const [planSectionUrl, setPlanSectionUrl] = useState<string>(initialUnit?.planSectionUrl || '');
  const [crossSectionUrl, setCrossSectionUrl] = useState<string>(initialUnit?.crossSectionUrl || '');
  const [planSectionProfileCode, setPlanSectionProfileCode] = useState<string>(initialUnit?.planSectionProfileCode || '');
  const [crossSectionProfileCode, setCrossSectionProfileCode] = useState<string>(initialUnit?.crossSectionProfileCode || '');
  
  const [selectedFrameProfile, setSelectedFrameProfile] = useState<string>(() => {
    if (initialUnit?.selectedFrameProfile) return initialUnit.selectedFrameProfile;
    const initialSysId = getNormalizedSystemId(initialUnit?.system || '', systems, initialUnit?.selectedFrameProfile);
    const sys = systems.find(s => s.id === initialSysId);
    if (sys?.profileCodes?.frame) return sys.profileCodes.frame;
    if (initialSysId === 'kurt-ktr-64t' || initialSysId.includes('64t')) return '64T-101';
    return initialSysId === 'kurt-51ls' ? '51LS-101-00' : '70T-102-18';
  });
  const [selectedSashProfile, setSelectedSashProfile] = useState<string>(() => {
    if (initialUnit?.selectedSashProfile) return initialUnit.selectedSashProfile;
    const initialSysId = getNormalizedSystemId(initialUnit?.system || '', systems, initialUnit?.selectedFrameProfile);
    const sys = systems.find(s => s.id === initialSysId);
    if (sys?.profileCodes?.sash) return sys.profileCodes.sash;
    if (initialSysId === 'kurt-ktr-64t' || initialSysId.includes('64t')) return '64T-201';
    return initialSysId === 'kurt-51ls' ? '51LS-201-00' : '70T-201-18';
  });
  const [selectedMullionProfile, setSelectedMullionProfile] = useState<string>(() => {
    if (initialUnit?.selectedMullionProfile) return initialUnit.selectedMullionProfile;
    const initialSysId = getNormalizedSystemId(initialUnit?.system || '', systems, initialUnit?.selectedFrameProfile);
    const sys = systems.find(s => s.id === initialSysId);
    if (sys?.profileCodes?.mullion) return sys.profileCodes.mullion;
    if (initialSysId === 'kurt-ktr-64t' || initialSysId.includes('64t')) return '64T-301';
    return initialSysId === 'kurt-51ls' ? '51LS-301-00' : '70T-301-18';
  });

  // Keep systemId synced if initialUnit or systems prop changes
  useEffect(() => {
    if (initialUnit) {
      const normSys = getNormalizedSystemId(initialUnit.system || '', systems, initialUnit.selectedFrameProfile);
      if (normSys && normSys !== systemId) {
        setSystemId(normSys);
      }
    }
  }, [initialUnit?.id, initialUnit?.system, initialUnit?.selectedFrameProfile, systems]);

  useEffect(() => {
    // If we switched systems, auto-switch to valid default profile codes
    const sys = systems.find(s => s.id === systemId);
    if (systemId === 'kurt-51ls' || systemId.includes('51ls')) {
      if (!selectedFrameProfile.startsWith('51LS') && !selectedFrameProfile.startsWith('51LM') && !selectedFrameProfile.startsWith('58T')) {
        setSelectedFrameProfile('51LS-101-00');
      }
      if (!selectedSashProfile.startsWith('51LS') && !selectedSashProfile.startsWith('51LM')) {
        setSelectedSashProfile('51LS-201-00');
      }
      if (!selectedMullionProfile.startsWith('51LS') && !selectedMullionProfile.startsWith('51LM') && !selectedMullionProfile.startsWith('07-')) {
        setSelectedMullionProfile('51LS-301-00');
      }
    } else if (systemId === 'kurt-70t-th' || systemId.includes('70t')) {
      if (!selectedFrameProfile.startsWith('70T')) {
        setSelectedFrameProfile('70T-102-18');
      }
      if (!selectedSashProfile.startsWith('70T')) {
        setSelectedSashProfile('70T-201-18');
      }
      if (!selectedMullionProfile.startsWith('70T')) {
        setSelectedMullionProfile('70T-301-18');
      }
    } else if (systemId === 'kurt-ktr-64t' || systemId.includes('64t')) {
      if (!selectedFrameProfile.startsWith('64T')) {
        setSelectedFrameProfile('64T-101');
      }
      if (!selectedSashProfile.startsWith('64T')) {
        setSelectedSashProfile('64T-201');
      }
      if (!selectedMullionProfile.startsWith('64T')) {
        setSelectedMullionProfile('64T-301');
      }
    } else if (sys?.profileCodes) {
      if (sys.profileCodes.frame && selectedFrameProfile !== sys.profileCodes.frame) {
        setSelectedFrameProfile(sys.profileCodes.frame);
      }
      if (sys.profileCodes.sash && selectedSashProfile !== sys.profileCodes.sash) {
        setSelectedSashProfile(sys.profileCodes.sash);
      }
      if (sys.profileCodes.mullion && selectedMullionProfile !== sys.profileCodes.mullion) {
        setSelectedMullionProfile(sys.profileCodes.mullion);
      }
    }
  }, [systemId, systems]);

  // Custom uploaded drawings mapping keyed by profile code to allow different drawings per style
  const [customProfileImages, setCustomProfileImages] = useState<Record<string, string>>(() => {
    const unitImages = initialUnit?.customProfileImages || {};
    try {
      const saved = localStorage.getItem('alumetric_custom_profile_images');
      if (saved) {
        return { ...JSON.parse(saved), ...unitImages };
      }
    } catch (e) {
      console.warn('Error loading custom profile images', e);
    }
    return unitImages;
  });

  const selectedSystem = useMemo(() => {
    return systems.find(s => s.id === systemId) || systems[0];
  }, [systems, systemId]);

  const getProfileImage = useCallback((code: string, type: 'frame' | 'sash' | 'mullion') => {
    const norm = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/70th/, '70t');
    const targetNorm = norm(code);

    // 1. check local storage overrides first
    if (customProfileImages[code]) {
      return customProfileImages[code];
    }
    const localMatchKey = Object.keys(customProfileImages).find(k => norm(k) === targetNorm);
    if (localMatchKey) {
      return customProfileImages[localMatchKey];
    }

    // 2. check system's custom drawings library from cloud
    if (selectedSystem?.profileDrawings) {
      const matches = selectedSystem.profileDrawings.filter(d => norm(d.code) === targetNorm);
      const withUrls = matches.find(d => d.crossSectionUrl || d.planSectionUrl);
      const found = withUrls || matches[0];
      if (found) {
        return found.crossSectionUrl || found.planSectionUrl || '';
      }
    }
    // 3. check system's direct properties
    if (type === 'frame') {
      if (norm(code) === norm(selectedSystem?.framePlanSectionProfileCode || '') && selectedSystem?.framePlanSectionUrl) return selectedSystem.framePlanSectionUrl;
      if (norm(code) === norm(selectedSystem?.frameCrossSectionProfileCode || '') && selectedSystem?.frameCrossSectionUrl) return selectedSystem.frameCrossSectionUrl;
    } else if (type === 'sash') {
      if (norm(code) === norm(selectedSystem?.sashPlanSectionProfileCode || '') && selectedSystem?.sashPlanSectionUrl) return selectedSystem.sashPlanSectionUrl;
      if (norm(code) === norm(selectedSystem?.sashCrossSectionProfileCode || '') && selectedSystem?.sashCrossSectionUrl) return selectedSystem.sashCrossSectionUrl;
    } else if (type === 'mullion') {
      if (norm(code) === norm(selectedSystem?.mullionPlanSectionProfileCode || '') && selectedSystem?.mullionPlanSectionUrl) return selectedSystem.mullionPlanSectionUrl;
      if (norm(code) === norm(selectedSystem?.mullionCrossSectionProfileCode || '') && selectedSystem?.mullionCrossSectionUrl) return selectedSystem.mullionCrossSectionUrl;
    }
    return '';
  }, [customProfileImages, selectedSystem]);

  const selectedFrameProfileImage = getProfileImage(selectedFrameProfile, 'frame');
  const selectedSashProfileImage = getProfileImage(selectedSashProfile, 'sash');
  const selectedMullionProfileImage = getProfileImage(selectedMullionProfile, 'mullion');

  const handleProfileImageUploaded = (code: string, base64: string) => {
    setCustomProfileImages(prev => {
      const updated = { ...prev, [code]: base64 };
      try {
        localStorage.setItem('alumetric_custom_profile_images', JSON.stringify(updated));
      } catch (e) {
        console.warn('Quota limit for images reached', e);
      }
      return updated;
    });
  };

  const handleProfileImageCleared = (code: string) => {
    setCustomProfileImages(prev => {
      const updated = { ...prev };
      delete updated[code];
      try {
        localStorage.setItem('alumetric_custom_profile_images', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving to localStorage', e);
      }
      return updated;
    });
  };

  const [customAccessoryImages, setCustomAccessoryImages] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('alumetric_custom_accessory_images');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error loading custom accessory images', e);
    }
    return {};
  });

  // Merge loaded cloud accessory images into customAccessoryImages state
  useEffect(() => {
    if (!accessories || accessories.length === 0) return;
    setCustomAccessoryImages(prev => {
      let updated = false;
      const nextImages = { ...prev };
      
      accessories.forEach(acc => {
        if (acc.imageUrl && nextImages[acc.id] !== acc.imageUrl) {
          nextImages[acc.id] = acc.imageUrl;
          updated = true;
        }
      });
      
      if (updated) {
        try {
          localStorage.setItem('alumetric_custom_accessory_images', JSON.stringify(nextImages));
        } catch (e) {
          console.warn('Error saving loaded accessory images to localStorage', e);
        }
        return nextImages;
      }
      return prev;
    });
  }, [accessories]);

  const [accessoryImageModal, setAccessoryImageModal] = useState<{ isOpen: boolean, accessory: Accessory | null }>({
    isOpen: false,
    accessory: null
  });

  const handleAccessoryImageUploaded = (id: string, base64: string) => {
    setCustomAccessoryImages(prev => {
      const updated = { ...prev, [id]: base64 };
      try {
        localStorage.setItem('alumetric_custom_accessory_images', JSON.stringify(updated));
      } catch (e) {
        console.warn('Quota limit for accessory images reached', e);
      }
      return updated;
    });
  };

  const handleAccessoryImageCleared = (id: string) => {
    setCustomAccessoryImages(prev => {
      const updated = { ...prev };
      delete updated[id];
      try {
        localStorage.setItem('alumetric_custom_accessory_images', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving to localStorage', e);
      }
      return updated;
    });
  };
  const [selectedTypology, setSelectedTypology] = useState<string>(() => {
    if (initialUnit?.typology) return initialUnit.typology;
    const initialSystem = systems.find(s => s.id === getNormalizedSystemId(initialUnit?.system || '', systems, initialUnit?.selectedFrameProfile));
    if (initialSystem && initialSystem.supportedTypologies && initialSystem.supportedTypologies.length > 0) {
      return initialSystem.supportedTypologies[0];
    }
    return 'hinged_window';
  });

  const handleSystemSelect = (newSystemId: string) => {
    setSystemId(newSystemId);
    
    // Auto-update profile defaults for this system to avoid stale/wrong profile selections
    const targetSystem = systems.find(s => s.id === newSystemId);
    if (newSystemId === 'kurt-51ls' || newSystemId.includes('51ls')) {
      setSelectedFrameProfile('51LS-101-00');
      setSelectedSashProfile('51LS-201-00');
      setSelectedMullionProfile('51LS-301-00');
    } else if (newSystemId === 'kurt-70t-th' || newSystemId.includes('70t')) {
      setSelectedFrameProfile('70T-102-18');
      setSelectedSashProfile('70T-201-18');
      setSelectedMullionProfile('70T-301-18');
    } else if (newSystemId === 'kurt-ktr-64t' || newSystemId.includes('64t')) {
      setSelectedFrameProfile('64T-101');
      setSelectedSashProfile('64T-201');
      setSelectedMullionProfile('64T-301');
    } else if (targetSystem?.profileCodes) {
      if (targetSystem.profileCodes.frame) setSelectedFrameProfile(targetSystem.profileCodes.frame);
      if (targetSystem.profileCodes.sash) setSelectedSashProfile(targetSystem.profileCodes.sash);
      if (targetSystem.profileCodes.mullion) setSelectedMullionProfile(targetSystem.profileCodes.mullion);
    }
    if (targetSystem) {
      // Check if current typology is compatible with the selected system
      let isCompatible = false;
      if (targetSystem.supportedTypologies && targetSystem.supportedTypologies.length > 0) {
        isCompatible = targetSystem.supportedTypologies.includes(selectedTypology);
      } else {
        const typoLower = selectedTypology.toLowerCase();
        if (typoLower.includes('sliding')) {
          isCompatible = (targetSystem.type === 'sliding');
        } else if (typoLower.includes('fixed') || typoLower.includes('storefront')) {
          isCompatible = true;
        } else {
          isCompatible = (targetSystem.type === 'hinged');
        }
      }

      if (!isCompatible) {
        // Automatically switch the typology to a default compatible one
        let nextTypology = 'hinged_window';
        if (targetSystem.supportedTypologies && targetSystem.supportedTypologies.length > 0) {
          nextTypology = targetSystem.supportedTypologies[0];
        } else if (targetSystem.type === 'sliding') {
          nextTypology = 'sliding_window';
        }
        setSelectedTypology(nextTypology);
        setRootNode(getInitialNodeForTypology(nextTypology));
        setSelectedNodeId(null);
      }
    }
  };

  const handleTypologySelect = (typoId: string) => {
    setSelectedTypology(typoId);
    setRootNode(getInitialNodeForTypology(typoId));
    setSelectedNodeId(null);

    // Check if the current system is compatible with this typology
    const activeSys = systems.find(s => s.id === systemId);
    const isCompatible = (sys: ProfileSystem) => {
      if (sys.supportedTypologies && sys.supportedTypologies.length > 0) {
        return sys.supportedTypologies.includes(typoId);
      }
      const typoLower = typoId.toLowerCase();
      if (typoLower.includes('sliding')) {
        return sys.type === 'sliding';
      }
      if (typoLower.includes('fixed') || typoLower.includes('storefront')) {
        return true;
      }
      return sys.type === 'hinged';
    };

    if (activeSys && !isCompatible(activeSys)) {
      // Find the first compatible system and switch to it
      const firstComp = systems.find(isCompatible);
      if (firstComp) {
        setSystemId(firstComp.id);
        if (firstComp.id === 'kurt-51ls' || firstComp.id.includes('51ls')) {
          setSelectedFrameProfile('51LS-101-00');
          setSelectedSashProfile('51LS-201-00');
          setSelectedMullionProfile('51LS-301-00');
        } else if (firstComp.id === 'kurt-70t-th' || firstComp.id.includes('70t')) {
          setSelectedFrameProfile('70T-102-18');
          setSelectedSashProfile('70T-201-18');
          setSelectedMullionProfile('70T-301-18');
        } else if (firstComp.id === 'kurt-ktr-64t' || firstComp.id.includes('64t')) {
          setSelectedFrameProfile('64T-101');
          setSelectedSashProfile('64T-201');
          setSelectedMullionProfile('64T-301');
        } else if (firstComp.profileCodes) {
          if (firstComp.profileCodes.frame) setSelectedFrameProfile(firstComp.profileCodes.frame);
          if (firstComp.profileCodes.sash) setSelectedSashProfile(firstComp.profileCodes.sash);
          if (firstComp.profileCodes.mullion) setSelectedMullionProfile(firstComp.profileCodes.mullion);
        }
      }
    }
  };
  const [color, setColor] = useState(initialUnit?.color || 'group1');
  const [specificColor, setSpecificColor] = useState(initialUnit?.specificColor || '');
  const [glassTypeId, setGlassTypeId] = useState(initialUnit?.glassType || GLASS_TYPES[0].id);
  const [rootNode, setRootNode] = useState<WindowNode>(() => {
    if (initialUnit?.rootNode) return initialUnit.rootNode;
    
    // Determine the initial typology
    let initialType = 'hinged_window';
    if (initialUnit?.typology) {
      initialType = initialUnit.typology;
    } else {
      const initialSystem = systems.find(s => s.id === getNormalizedSystemId(initialUnit?.system || '', systems, initialUnit?.selectedFrameProfile));
      if (initialSystem && initialSystem.supportedTypologies && initialSystem.supportedTypologies.length > 0) {
        initialType = initialSystem.supportedTypologies[0];
      }
    }
    return getInitialNodeForTypology(initialType);
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hasThreshold, setHasThreshold] = useState<boolean>(initialUnit?.hasThreshold || false);
  const [includeGlass, setIncludeGlass] = useState<boolean>(initialUnit?.includeGlass !== false);
  const [customGlassPriceInput, setCustomGlassPriceInput] = useState<string>(
    initialUnit?.customGlassPrice !== undefined ? initialUnit.customGlassPrice.toString() : ''
  );
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [showSection, setShowSection] = useState(false);
  
  const [visualScale, setVisualScale] = useState(0.20);
  const [history, setHistory] = useState<WindowNode[]>([]);
  const [inputVal1, setInputVal1] = useState<string>('');
  const [inputVal2, setInputVal2] = useState<string>('');

  const [selectedHandle, setSelectedHandle] = useState(initialUnit?.selectedHandle || '');
  const [selectedHinge, setSelectedHinge] = useState(initialUnit?.selectedHinge || '');
  const [selectedGasket, setSelectedGasket] = useState(initialUnit?.selectedGasket || '');
  const [selectedLock, setSelectedLock] = useState(initialUnit?.selectedLock || '');
  const [selectedCorner, setSelectedCorner] = useState(initialUnit?.selectedCorner || '');
  const [selectedAutomation, setSelectedAutomation] = useState(initialUnit?.selectedAutomation || '');
  const [selectedKickplate, setSelectedKickplate] = useState(initialUnit?.selectedKickplate || '');
  const [selectedDoorCloser, setSelectedDoorCloser] = useState(initialUnit?.selectedDoorCloser || '');
  const [selectedLockStriker, setSelectedLockStriker] = useState(initialUnit?.selectedLockStriker || '');
  const [selectedOther, setSelectedOther] = useState(initialUnit?.selectedOther || '');
  const [activePack, setActivePack] = useState<'standard' | 'premium' | 'heavyduty' | null>(null);

  const [previewType, setPreviewType] = useState<'svg' | 'canvas'>('svg');
  const [isVisualizing, setIsVisualizing] = useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const drawCanvasPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-DPI support
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Padding for dimensions
    const padX = 60;
    const padY = 60;
    const availW = w - padX * 2;
    const availH = h - padY * 2;

    const scale = Math.min(availW / width, availH / height);
    const drawW = width * scale;
    const drawH = height * scale;
    const startX = padX + (availW - drawW) / 2;
    const startY = padY + (availH - drawH) / 2;

    const isDark = theme === 'dark';
    const profileColor = isDark ? '#334155' : '#e2e8f0';
    const profileSelectedColor = isDark ? '#1e3a8a' : '#bfdbfe';
    const strokeColor = isDark ? '#475569' : '#94a3b8';
    const selectedStrokeColor = isDark ? '#3b82f6' : '#2563eb';
    const glassColor = 'rgba(186, 230, 253, 0.6)'; // beautiful glossy blue
    const hardwareColor = isDark ? '#94a3b8' : '#1e293b';
    const arrowColor = isDark ? '#64748b' : '#475569';

    const selectedSystem = systems.find(s => s.id === systemId) || systems[0];
    const frameWidth = selectedSystem.frameWidth;
    const frameWidthScaled = frameWidth * scale;

    const bottomFw = hasThreshold ? Math.min(15, frameWidth) : frameWidth;
    const bottomFwScaled = bottomFw * scale;

    const sashWidth = 55;
    const sashWidthScaled = sashWidth * scale;

    // Helper for drawing shapes
    const drawRect = (rx: number, ry: number, rw: number, rh: number, fill: string, stroke: string, strokeW: number, selected: boolean) => {
      ctx.fillStyle = fill;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = selected ? selectedStrokeColor : stroke;
      ctx.lineWidth = selected ? strokeW + 1 : strokeW;
      ctx.strokeRect(rx, ry, rw, rh);

      // Accent inner CAD line
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(rx + 3, ry + 3, Math.max(0, rw - 6), Math.max(0, rh - 6));
    };

    // Helper for path clipping based on shape
    const setShapeClipPath = (isInner: boolean) => {
      ctx.beginPath();
      if (shape === 'triangle') {
        if (!isInner) {
          ctx.moveTo(startX, startY + drawH);
          ctx.lineTo(startX + drawW / 2, startY);
          ctx.lineTo(startX + drawW, startY + drawH);
        } else {
          const sideLen = Math.sqrt((drawW / 2) * (drawW / 2) + drawH * drawH);
          const sinA = drawH / sideLen;
          const cosA = (drawW / 2) / sideLen;
          const ix = frameWidthScaled * (1 + cosA) / sinA;
          const iy = startY + drawH - bottomFwScaled;
          const topY = startY + frameWidthScaled / cosA;
          ctx.moveTo(startX + ix, iy);
          ctx.lineTo(startX + drawW / 2, topY);
          ctx.lineTo(startX + drawW - ix, iy);
        }
        ctx.closePath();
      } else if (shape === 'arch') {
        const aH = (archHeight / height) * drawH;
        if (!isInner) {
          ctx.moveTo(startX, startY + drawH);
          ctx.lineTo(startX, startY + aH);
          ctx.quadraticCurveTo(startX + drawW / 2, startY, startX + drawW, startY + aH);
          ctx.lineTo(startX + drawW, startY + drawH);
        } else {
          const iw = drawW - 2 * frameWidthScaled;
          const iaH = aH - frameWidthScaled;
          ctx.moveTo(startX + frameWidthScaled, startY + drawH - bottomFwScaled);
          ctx.lineTo(startX + frameWidthScaled, startY + aH);
          ctx.quadraticCurveTo(startX + drawW / 2, startY + frameWidthScaled, startX + drawW - frameWidthScaled, startY + aH);
          ctx.lineTo(startX + drawW - frameWidthScaled, startY + drawH - bottomFwScaled);
        }
        ctx.closePath();
      } else {
        if (!isInner) {
          ctx.rect(startX, startY, drawW, drawH);
        } else {
          ctx.rect(startX + frameWidthScaled, startY + frameWidthScaled, drawW - 2 * frameWidthScaled, drawH - frameWidthScaled - bottomFwScaled);
        }
      }
    };

    // View Perspective (Interior/Exterior) support
    ctx.save();
    if (viewPerspective === 'exterior') {
      ctx.translate(startX + drawW / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(startX + drawW / 2), 0);
    }

    // 1. Draw outer frame background
    ctx.save();
    setShapeClipPath(false);
    ctx.fillStyle = rootNode.id === selectedNodeId ? profileSelectedColor : profileColor;
    ctx.fill();
    ctx.strokeStyle = rootNode.id === selectedNodeId ? selectedStrokeColor : strokeColor;
    ctx.lineWidth = rootNode.id === selectedNodeId ? 2 : 1.5;
    ctx.stroke();
    ctx.restore();

    // Draw safety threshold warning stripes if active
    if (hasThreshold) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(startX, startY + drawH - bottomFwScaled, drawW, bottomFwScaled);
      ctx.clip();

      ctx.fillStyle = isDark ? '#1e293b' : '#334155';
      ctx.fillRect(startX, startY + drawH - bottomFwScaled, drawW, bottomFwScaled);

      // Warning strip
      ctx.fillStyle = '#eab308';
      ctx.fillRect(startX, startY + drawH - bottomFwScaled + 1, drawW, Math.max(1, bottomFwScaled - 2));

      // Stripes
      ctx.fillStyle = '#1e293b';
      for (let i = 0; i < drawW / 12; i++) {
        ctx.beginPath();
        ctx.moveTo(startX + i * 12, startY + drawH);
        ctx.lineTo(startX + i * 12 + 4, startY + drawH - bottomFwScaled);
        ctx.lineTo(startX + i * 12 + 7, startY + drawH - bottomFwScaled);
        ctx.lineTo(startX + i * 12 + 3, startY + drawH);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Recursive Node Drawing inside the inner frame bounds
    ctx.save();
    setShapeClipPath(true);
    ctx.clip();

    const drawNode = (node: WindowNode, x: number, y: number, w: number, h: number) => {
      const isSelected = node.id === selectedNodeId;

      if (node.type === 'container' && node.children?.length === 2 && node.splitRatio) {
        const isVertical = node.direction === 'vertical';
        const totalSize = isVertical ? w - frameWidthScaled : h - frameWidthScaled;
        const size1 = totalSize * node.splitRatio[0];
        const size2 = totalSize * node.splitRatio[1];

        // Draw child 1
        drawNode(node.children[0], x, y, isVertical ? size1 : w, isVertical ? h : size1);

        // Draw middle partition line
        const mx = isVertical ? x + size1 : x;
        const my = isVertical ? y : y + size1;
        const mw = isVertical ? frameWidthScaled : w;
        const mh = isVertical ? h : frameWidthScaled;
        drawRect(mx, my, mw, mh, isSelected ? profileSelectedColor : profileColor, strokeColor, 1.2, isSelected);

        // Draw child 2
        const sx = isVertical ? x + size1 + frameWidthScaled : x;
        const sy = isVertical ? y : y + size1 + frameWidthScaled;
        drawNode(node.children[1], sx, sy, isVertical ? size2 : w, isVertical ? h : size2);
      } else {
        if (node.type === 'void') {
          // Draw Void Opening (Dashed Box + Diagonal CAD Cross X + Label)
          ctx.fillStyle = isSelected ? (isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(219, 234, 254, 0.6)') : (isDark ? '#0f172a' : '#f8fafc');
          ctx.fillRect(x, y, w, h);

          ctx.save();
          ctx.strokeStyle = isSelected ? selectedStrokeColor : (isDark ? '#64748b' : '#94a3b8');
          ctx.lineWidth = 1.2;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(x, y, w, h);

          // Diagonal cross X
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y + h);
          ctx.moveTo(x + w, y);
          ctx.lineTo(x, y + h);
          ctx.stroke();
          ctx.restore();

          // Void label badge
          const voidText = lang === 'tr' ? 'BOŞLUK / VOID' : 'VOID OPENING';
          const sizeText = `${Math.round(w / scale)} × ${Math.round(h / scale)} mm`;
          ctx.font = 'bold 9px monospace';
          const textWidth = Math.max(ctx.measureText(voidText).width, ctx.measureText(sizeText).width);
          const badgeW = Math.min(w * 0.9, textWidth + 16);
          const badgeH = 26;
          const badgeX = x + w / 2 - badgeW / 2;
          const badgeY = y + h / 2 - badgeH / 2;

          ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
          ctx.strokeStyle = isSelected ? selectedStrokeColor : (isDark ? '#475569' : '#cbd5e1');
          ctx.lineWidth = 1;
          ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
          ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

          ctx.fillStyle = isDark ? '#cbd5e1' : '#475569';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(voidText, x + w / 2, badgeY + 10);

          ctx.fillStyle = isDark ? '#38bdf8' : '#2563eb';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(sizeText, x + w / 2, badgeY + 21);
          return;
        }

        const isOpening = node.openingType && node.openingType !== 'fixed';
        let glassX = x;
        let glassY = y;
        let glassW = w;
        let glassH = h;

        if (isOpening) {
          // Draw Sash Frame around glass
          drawRect(x, y, w, h, isSelected ? profileSelectedColor : profileColor, strokeColor, 1.2, isSelected);
          glassX = x + sashWidthScaled;
          glassY = y + sashWidthScaled;
          glassW = Math.max(0, w - sashWidthScaled * 2);
          glassH = Math.max(0, h - sashWidthScaled * 2);
        }

        // Draw glass pane
        ctx.fillStyle = glassColor;
        ctx.fillRect(glassX, glassY, glassW, glassH);
        ctx.strokeStyle = isSelected ? selectedStrokeColor : strokeColor;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(glassX, glassY, glassW, glassH);

        // Glass glossy effect
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(glassX + 12, glassY + 12);
        ctx.lineTo(glassX + Math.min(40, glassW - 10), glassY + Math.min(40, glassH - 10));
        ctx.moveTo(glassX + 22, glassY + 12);
        ctx.lineTo(glassX + Math.min(32, glassW - 10), glassY + Math.min(22, glassH - 10));
        ctx.stroke();

        // Draw segment size badge inside pane (LogiKal style)
        if (glassW >= 50 && glassH >= 35) {
          const paneText = `${Math.round(w / scale)} × ${Math.round(h / scale)}`;
          ctx.font = 'bold 8px monospace';
          const pWidth = ctx.measureText(paneText).width;
          ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.85)';
          ctx.fillRect(glassX + glassW / 2 - pWidth / 2 - 3, glassY + glassH - (isOpening ? 18 : 14), pWidth + 6, 11);
          ctx.strokeStyle = isDark ? '#334155' : '#cbd5e1';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(glassX + glassW / 2 - pWidth / 2 - 3, glassY + glassH - (isOpening ? 18 : 14), pWidth + 6, 11);
          ctx.fillStyle = isDark ? '#94a3b8' : '#334155';
          ctx.fillText(paneText, glassX + glassW / 2, glassY + glassH - (isOpening ? 9 : 5));
        }

        // Draw Opening Arrows/Symbols
        const type = node.openingType || 'fixed';
        if (type !== 'fixed') {
          ctx.strokeStyle = arrowColor;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);

          if (type.includes('left') && !type.includes('sliding')) {
            ctx.beginPath();
            ctx.moveTo(glassX, glassY);
            ctx.lineTo(glassX + glassW, glassY + glassH / 2);
            ctx.lineTo(glassX, glassY + glassH);
            ctx.stroke();
          } else if (type.includes('right') && !type.includes('sliding')) {
            ctx.beginPath();
            ctx.moveTo(glassX + glassW, glassY);
            ctx.lineTo(glassX, glassY + glassH / 2);
            ctx.lineTo(glassX + glassW, glassY + glassH);
            ctx.stroke();
          }

          if (type.includes('tilt')) {
            ctx.beginPath();
            ctx.moveTo(glassX, glassY + glassH);
            ctx.lineTo(glassX + glassW / 2, glassY);
            ctx.lineTo(glassX + glassW, glassY + glassH);
            ctx.stroke();
          }

          ctx.setLineDash([]); // reset dash

          // Sliding symbol arrow
          if (type.includes('sliding')) {
            const arrowY = glassY + glassH / 2;
            ctx.beginPath();
            ctx.moveTo(glassX + 15, arrowY);
            ctx.lineTo(glassX + glassW - 15, arrowY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(glassX + glassW - 20, arrowY - 3);
            ctx.lineTo(glassX + glassW - 15, arrowY);
            ctx.lineTo(glassX + glassW - 20, arrowY + 3);
            ctx.fillStyle = arrowColor;
            ctx.fill();
          }

          // Handles & Hinges
          ctx.fillStyle = hardwareColor;
          if (type.includes('left') && !type.includes('sliding')) {
            // Hinges
            ctx.fillRect(glassX - 1, glassY + 15, 2.5, 8);
            ctx.fillRect(glassX - 1, glassY + glassH - 23, 2.5, 8);
            // Handle
            ctx.fillRect(glassX + glassW - 8, glassY + glassH / 2 - 6, 2.5, 12);
            ctx.fillRect(glassX + glassW - 11, glassY + glassH / 2 - 1.5, 4, 3);
          } else if (type.includes('right') && !type.includes('sliding')) {
            // Hinges
            ctx.fillRect(glassX + glassW - 1.5, glassY + 15, 2.5, 8);
            ctx.fillRect(glassX + glassW - 1.5, glassY + glassH - 23, 2.5, 8);
            // Handle
            ctx.fillRect(glassX + 5, glassY + glassH / 2 - 6, 2.5, 12);
            ctx.fillRect(glassX + 7, glassY + glassH / 2 - 1.5, 4, 3);
          } else if (type === 'tilt') {
            // Hinges bottom
            ctx.fillRect(glassX + 15, glassY + glassH - 1.5, 8, 2.5);
            ctx.fillRect(glassX + glassW - 23, glassY + glassH - 1.5, 8, 2.5);
            // Handle top
            ctx.fillRect(glassX + glassW / 2 - 6, glassY + 5, 12, 2.5);
            ctx.fillRect(glassX + glassW / 2 - 1.5, glassY + 7, 3, 4);
          } else if (type.includes('sliding')) {
            // Handle
            ctx.fillRect(glassX + 6, glassY + glassH / 2 - 8, 2.5, 16);
          }
        }
      }
    };

    // Draw nodes
    drawNode(rootNode, startX + frameWidthScaled, startY + frameWidthScaled, drawW - 2 * frameWidthScaled, drawH - frameWidthScaled - bottomFwScaled);

    ctx.restore(); // Restore from clipping path
    ctx.restore(); // Restore from viewPerspective transform

    // 3. Dimensions drawing
    ctx.strokeStyle = isDark ? '#475569' : '#94a3b8';
    ctx.fillStyle = isDark ? '#94a3b8' : '#334155';
    ctx.lineWidth = 1;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';

    // 1. Overall Width line (Top)
    const dimY = startY - 20;
    ctx.beginPath();
    ctx.moveTo(startX, dimY);
    ctx.lineTo(startX + drawW, dimY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(startX, dimY - 4);
    ctx.lineTo(startX, dimY + 4);
    ctx.moveTo(startX + drawW, dimY - 4);
    ctx.lineTo(startX + drawW, dimY + 4);
    ctx.stroke();

    const wText = `${width} mm`;
    const wTextWidth = ctx.measureText(wText).width;
    ctx.fillStyle = isDark ? '#020617' : '#ffffff';
    ctx.fillRect(startX + drawW / 2 - wTextWidth / 2 - 4, dimY - 6, wTextWidth + 8, 12);
    ctx.fillStyle = isDark ? '#38bdf8' : '#2563eb';
    ctx.fillText(wText, startX + drawW / 2, dimY + 3);

    // 2. Overall Height line (Left)
    const dimX = startX - 25;
    ctx.beginPath();
    ctx.moveTo(dimX, startY);
    ctx.lineTo(dimX, startY + drawH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(dimX - 4, startY);
    ctx.lineTo(dimX + 4, startY);
    ctx.moveTo(dimX - 4, startY + drawH);
    ctx.lineTo(dimX + 4, startY + drawH);
    ctx.stroke();

    ctx.save();
    ctx.translate(dimX, startY + drawH / 2);
    ctx.rotate(-Math.PI / 2);
    const hText = `${height} mm`;
    const hTextWidth = ctx.measureText(hText).width;
    ctx.fillStyle = isDark ? '#020617' : '#ffffff';
    ctx.fillRect(-hTextWidth / 2 - 4, -6, hTextWidth + 8, 12);
    ctx.fillStyle = isDark ? '#38bdf8' : '#2563eb';
    ctx.fillText(hText, 0, 3);
    ctx.restore();

    // 3. Right Vertical Sub-Division Segments (Dikey Bölmelerin Uzunlukları)
    const yCuts = getYCuts(rootNode, 0, height, frameWidthScaled / scale);
    const vSegments = getSegmentsFromCuts(yCuts, height);
    if (vSegments.length > 1) {
      const segDimX = startX + drawW + 25;
      vSegments.forEach(seg => {
        const segStartY = startY + seg.start * scale;
        const segEndY = startY + seg.end * scale;
        const segMidY = (segStartY + segEndY) / 2;

        ctx.beginPath();
        ctx.moveTo(startX + drawW + 4, segStartY);
        ctx.lineTo(segDimX + 4, segStartY);
        ctx.moveTo(startX + drawW + 4, segEndY);
        ctx.lineTo(segDimX + 4, segEndY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(segDimX, segStartY);
        ctx.lineTo(segDimX, segEndY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(segDimX - 4, segStartY);
        ctx.lineTo(segDimX + 4, segStartY);
        ctx.moveTo(segDimX - 4, segEndY);
        ctx.lineTo(segDimX + 4, segEndY);
        ctx.stroke();

        ctx.save();
        ctx.translate(segDimX, segMidY);
        ctx.rotate(-Math.PI / 2);
        const segText = `${seg.length} mm`;
        const stWidth = ctx.measureText(segText).width;
        ctx.fillStyle = isDark ? '#020617' : '#ffffff';
        ctx.fillRect(-stWidth / 2 - 3, -5, stWidth + 6, 10);
        ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(segText, 0, 3);
        ctx.restore();
      });
    }

    // 4. Bottom Horizontal Sub-Division Segments (Yatay Bölmelerin Genişlikleri)
    const xCuts = getXCuts(rootNode, 0, width, frameWidthScaled / scale);
    const hSegments = getSegmentsFromCuts(xCuts, width);
    if (hSegments.length > 1) {
      const segDimY = startY + drawH + 20;
      hSegments.forEach(seg => {
        const segStartX = startX + seg.start * scale;
        const segEndX = startX + seg.end * scale;
        const segMidX = (segStartX + segEndX) / 2;

        ctx.beginPath();
        ctx.moveTo(segStartX, startY + drawH + 4);
        ctx.lineTo(segStartX, segDimY + 4);
        ctx.moveTo(segEndX, startY + drawH + 4);
        ctx.lineTo(segEndX, segDimY + 4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(segStartX, segDimY);
        ctx.lineTo(segEndX, segDimY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(segStartX, segDimY - 4);
        ctx.lineTo(segStartX, segDimY + 4);
        ctx.moveTo(segEndX, segDimY - 4);
        ctx.lineTo(segEndX, segDimY + 4);
        ctx.stroke();

        const segText = `${seg.length} mm`;
        ctx.font = 'bold 9px monospace';
        const stWidth = ctx.measureText(segText).width;
        ctx.fillStyle = isDark ? '#020617' : '#ffffff';
        ctx.fillRect(segMidX - stWidth / 2 - 3, segDimY - 5, stWidth + 6, 10);
        ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
        ctx.fillText(segText, segMidX, segDimY + 3);
      });
    }

  }, [width, height, rootNode, selectedNodeId, shape, archHeight, hasThreshold, theme, systemId, systems, viewPerspective]);

  useEffect(() => {
    if (previewType === 'canvas') {
      const timer = setTimeout(() => {
        drawCanvasPreview();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [previewType, drawCanvasPreview]);

  useEffect(() => {
    const maxDim = Math.max(width, height);
    if (maxDim > 3000) setVisualScale(0.12);
    else if (maxDim > 2000) setVisualScale(0.18);
  }, []);

  useEffect(() => {
    const system = systems.find(s => s.id === systemId);
    if (!system) return;

    const validateNodes = (node: WindowNode): WindowNode => {
      let updated = { ...node };
      if (node.children) {
        updated.children = node.children.map(validateNodes);
      }
      return updated;
    };
    
    setRootNode(prev => validateNodes(prev));

    const checkAcc = (id: string) => {
      if (!id) return '';
      const acc = accessories.find(a => a.id === id);
      if (acc && acc.compatibility && acc.compatibility !== 'both' && acc.compatibility !== system.type) {
        return '';
      }
      return id;
    };

    setSelectedHandle(prev => checkAcc(prev));
    setSelectedHinge(prev => checkAcc(prev));
    setSelectedGasket(prev => checkAcc(prev));
    setSelectedLock(prev => checkAcc(prev));
    setSelectedCorner(prev => checkAcc(prev));
    setSelectedAutomation(prev => checkAcc(prev));
    setSelectedKickplate(prev => checkAcc(prev));
    setSelectedDoorCloser(prev => checkAcc(prev));
    setSelectedLockStriker(prev => checkAcc(prev));
    setSelectedOther(prev => checkAcc(prev));
  }, [systemId, systems, accessories]);

  const currentCatalog = useMemo(() => {
    if (systemId === 'kurt-51ls' || systemId.includes('51ls')) return KURTOGLU_51LS_CATALOG;
    if (systemId === 'kurt-70t-th' || systemId.includes('70t')) return KURTOGLU_70T_CATALOG;
    if (systemId === 'kurt-ktr-64t' || systemId.includes('64t')) return KURTOGLU_KTR64T_CATALOG;

    // If the system has custom profile drawings defined in Settings, auto-generate catalog list
    if (selectedSystem?.profileDrawings && selectedSystem.profileDrawings.length > 0) {
      return selectedSystem.profileDrawings.map(d => ({
        code: d.code,
        weight: (d as any).weight || 1.5,
        type: (d.type as 'frame' | 'sash' | 'mullion') || 'frame',
        nameTr: (d as any).nameTr || d.description || d.code,
        nameEn: (d as any).nameEn || d.description || d.code
      }));
    }
    return null;
  }, [systemId, selectedSystem]);

  // Dynamically calculate unit glass weight!
  const currentUnitDummy: Unit = useMemo(() => ({
    id: initialUnit?.id || 'temp-unit',
    name,
    width: Number(width) || 0,
    height: Number(height) || 0,
    system: systemId,
    color,
    specificColor,
    glassType: glassTypeId,
    glassThickness: 24,
    rootNode,
    quantity: 1,
    shape,
    archHeight,
    hasThreshold,
  }), [initialUnit?.id, name, width, height, systemId, color, specificColor, glassTypeId, rootNode, shape, archHeight, hasThreshold]);

  // Try to calculate weights and recommended accessories
  const { totalGlassWeight, recommendedHinge, recommendedRoller } = useMemo(() => {
    let totalGlassWeight = 0;
    try {
      const glassPanesList = extractGlassPanes(currentUnitDummy, selectedSystem);
      totalGlassWeight = glassPanesList.reduce((acc, p) => acc + (p.weight || 0), 0);
    } catch (err) {
      console.error("Error calculating glass panes:", err);
    }

    // Recommended Hinge
    let recommendedHinge: Accessory | null = null;
    if (selectedSystem.type === 'hinged') {
      const compatibleHinges = accessories.filter(a => a.type === 'hinge' && (a.compatibility === 'both' || a.compatibility === 'hinged' || !a.compatibility));
      if (compatibleHinges.length > 0) {
        const sorted = [...compatibleHinges].sort((a, b) => (a.maxWeightKg || 999) - (b.maxWeightKg || 999));
        const found = sorted.find(h => (h.maxWeightKg || 999) >= totalGlassWeight);
        recommendedHinge = found || sorted[sorted.length - 1]; // highest as fallback
      }
    }

    // Recommended Roller
    let recommendedRoller: Accessory | null = null;
    if (selectedSystem.type === 'sliding') {
      const compatibleRollers = accessories.filter(a => a.type === 'other' && (a.compatibility === 'both' || a.compatibility === 'sliding' || !a.compatibility));
      if (compatibleRollers.length > 0) {
        const sorted = [...compatibleRollers].sort((a, b) => (a.maxWeightKg || 999) - (b.maxWeightKg || 999));
        const found = sorted.find(h => (h.maxWeightKg || 999) >= totalGlassWeight);
        recommendedRoller = found || sorted[sorted.length - 1]; // highest as fallback
      }
    }

    return { totalGlassWeight, recommendedHinge, recommendedRoller };
  }, [currentUnitDummy, selectedSystem, accessories]);

  // Auto-select hinges/rollers on weight changes
  useEffect(() => {
    if (selectedSystem.type === 'hinged' && recommendedHinge) {
      setSelectedHinge(recommendedHinge.id);
    } else if (selectedSystem.type === 'sliding' && recommendedRoller) {
      setSelectedOther(recommendedRoller.id);
    }
  }, [totalGlassWeight, selectedSystem.type, recommendedHinge?.id, recommendedRoller?.id]);

  const handleUpdateRootNode = useCallback((newNode: WindowNode) => {
    setHistory(prev => [...prev, rootNode]);
    setRootNode(newNode);
  }, [rootNode]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setRootNode(previous);
    setSelectedNodeId(null);
  };

  const findAndUpdateNode = (node: WindowNode, targetId: string, updateFn: (node: WindowNode) => WindowNode): WindowNode => {
    if (node.id === targetId) return updateFn(node);
    if (node.children) {
      return { ...node, children: node.children.map(child => findAndUpdateNode(child, targetId, updateFn)) };
    }
    return node;
  };

  const handleSplit = (direction: SplitDirection) => {
    if (!selectedNodeId) return;
    handleUpdateRootNode(findAndUpdateNode(rootNode, selectedNodeId, (node) => ({
      ...node,
      type: 'container',
      direction,
      splitRatio: [0.5, 0.5],
      openingType: 'fixed',
      children: [
        { id: uuidv4(), type: 'glass', openingType: 'fixed' },
        { id: uuidv4(), type: 'glass', openingType: 'fixed' }
      ]
    })));
    setSelectedNodeId(null);
  };

  const handleSetOpening = (type: string) => {
    if (!selectedNodeId) return;
    handleUpdateRootNode(findAndUpdateNode(rootNode, selectedNodeId, (node) => ({
      ...node,
      type: 'glass',
      openingType: type as any
    })));
  };

  const handleSetNodeType = (type: NodeType) => {
    if (!selectedNodeId) return;
    handleUpdateRootNode(findAndUpdateNode(rootNode, selectedNodeId, (node) => ({
      ...node,
      type,
      openingType: type === 'void' ? 'fixed' : (node.openingType || 'fixed')
    })));
  };

  const handleUpdateSplitRatio = (ratio0: number) => {
    if (!selectedNodeId) return;
    const ratio1 = 1 - ratio0;
    handleUpdateRootNode(findAndUpdateNode(rootNode, selectedNodeId, (node) => ({
      ...node,
      splitRatio: [ratio0, ratio1]
    })));
  };

  const handleSwapSashes = () => {
    let targetNodeId: string | null = null;
    if (selectedNode?.type === 'container' && selectedNode.children?.length === 2) {
      targetNodeId = selectedNode.id;
    } else if (parentId) {
      const parentNode = findNode(rootNode, parentId);
      if (parentNode && parentNode.children?.length === 2) {
        targetNodeId = parentId;
      }
    } else if (rootNode.type === 'container' && rootNode.children?.length === 2) {
      targetNodeId = rootNode.id;
    }

    if (targetNodeId) {
      handleUpdateRootNode(findAndUpdateNode(rootNode, targetNodeId, (node) => {
        if (node.children && node.children.length === 2) {
          return {
            ...node,
            children: [node.children[1], node.children[0]],
            splitRatio: node.splitRatio ? [node.splitRatio[1], node.splitRatio[0]] : [0.5, 0.5]
          };
        }
        return node;
      }));
    } else {
      const swapRecursive = (node: WindowNode): WindowNode => {
        if (node.type === 'container' && node.children && node.children.length === 2) {
          return {
            ...node,
            children: [node.children[1], node.children[0]],
            splitRatio: node.splitRatio ? [node.splitRatio[1], node.splitRatio[0]] : [0.5, 0.5]
          };
        }
        if (node.children) {
          return { ...node, children: node.children.map(swapRecursive) };
        }
        return node;
      };
      handleUpdateRootNode(swapRecursive(rootNode));
    }
  };

  const findNode = (node: WindowNode, id: string): WindowNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findParentId = (node: WindowNode, targetId: string): string | null => {
    if (!node.children) return null;
    if (node.children.some(c => c.id === targetId)) return node.id;
    for (const child of node.children) {
      const found = findParentId(child, targetId);
      if (found) return found;
    }
    return null;
  };

  const selectedNode = selectedNodeId ? findNode(rootNode, selectedNodeId) : null;
  const parentId = selectedNodeId ? findParentId(rootNode, selectedNodeId) : null;

  const handleSave = () => {
    const glassObj = GLASS_TYPES.find(g => g.id === glassTypeId) || GLASS_TYPES[0];
    const customPriceNum = customGlassPriceInput.trim() !== '' ? Number(customGlassPriceInput) : undefined;
    onSave({
      id: initialUnit?.id || uuidv4(),
      name, width, height, system: systemId,
      color,
      specificColor,
      glassType: glassTypeId, glassThickness: glassObj.thickness,
      rootNode, quantity: Math.max(1, quantity), shape, archHeight,
      hasThreshold,
      includeGlass,
      customGlassPrice: customPriceNum,
      selectedHandle, selectedHinge, selectedGasket, selectedLock, 
      selectedCorner, selectedAutomation, selectedKickplate, 
      selectedDoorCloser, selectedLockStriker, selectedOther,
      typology: selectedTypology,
      selectedFrameProfile,
      selectedSashProfile,
      selectedMullionProfile,
      selectedFrameProfileImage,
      selectedSashProfileImage,
      selectedMullionProfileImage,
      customProfileImages,
      viewPerspective,
      planSectionUrl,
      crossSectionUrl,
      planSectionProfileCode,
      crossSectionProfileCode
    });
  };

  const handleSaveAsNew = () => {
    const glassObj = GLASS_TYPES.find(g => g.id === glassTypeId) || GLASS_TYPES[0];
    const customPriceNum = customGlassPriceInput.trim() !== '' ? Number(customGlassPriceInput) : undefined;
    
    // Auto-increment name if the name is unchanged from the original
    let newUnitName = name;
    if (initialUnit && name === initialUnit.name) {
      const match = name.match(/^(.*?)(\d+)$/);
      if (match) {
        newUnitName = `${match[1]}${parseInt(match[2], 10) + 1}`;
      } else {
        newUnitName = `${name} (${lang === 'tr' ? 'Kopya' : 'Copy'})`;
      }
    }

    onSave({
      id: uuidv4(), // New ID creates a brand new unit
      name: newUnitName,
      width, height, system: systemId,
      color,
      specificColor,
      glassType: glassTypeId, glassThickness: glassObj.thickness,
      rootNode, quantity: Math.max(1, quantity), shape, archHeight,
      hasThreshold,
      includeGlass,
      customGlassPrice: customPriceNum,
      selectedHandle, selectedHinge, selectedGasket, selectedLock, 
      selectedCorner, selectedAutomation, selectedKickplate, 
      selectedDoorCloser, selectedLockStriker, selectedOther,
      typology: selectedTypology,
      selectedFrameProfile,
      selectedSashProfile,
      selectedMullionProfile,
      selectedFrameProfileImage,
      selectedSashProfileImage,
      selectedMullionProfileImage,
      customProfileImages,
      viewPerspective,
      planSectionUrl,
      crossSectionUrl,
      planSectionProfileCode,
      crossSectionProfileCode
    });
  };

  const applyPresetPackage = (packType: 'standard' | 'premium' | 'heavyduty') => {
    setActivePack(packType);
    const systemType = selectedSystem.type;

    // Gasket
    const gasket = accessories.find(a => a.type === 'gasket' && (a.compatibility === 'both' || a.compatibility === systemType || !a.compatibility));
    if (gasket) setSelectedGasket(gasket.id);

    // Corner
    const corner = accessories.find(a => a.type === 'corner' && (a.compatibility === 'both' || a.compatibility === systemType || !a.compatibility));
    if (corner) setSelectedCorner(corner.id);

    // Handle
    let handle = null;
    const handles = accessories.filter(a => a.type === 'handle' && (a.compatibility === 'both' || a.compatibility === systemType || !a.compatibility));
    if (handles.length > 0) {
      if (systemType === 'sliding') {
        if (packType === 'standard') {
          handle = handles.find(h => h.name.toLowerCase().includes('gömme') || h.name.toLowerCase().includes('tutamak') || h.name.toLowerCase().includes('flush') || h.id.includes('sh1'));
        } else {
          handle = handles.find(h => h.name.toLowerCase().includes('kaldırma') || h.name.toLowerCase().includes('hs') || h.name.toLowerCase().includes('portal') || h.id.includes('h3'));
        }
      } else {
        if (packType === 'standard') {
          handle = handles.find(h => h.name.toLowerCase().includes('pencere') || h.name.toLowerCase().includes('globe') || h.name.toLowerCase().includes('standart') || h.id.includes('h1'));
        } else {
          handle = handles.find(h => h.name.toLowerCase().includes('kilit') || h.name.toLowerCase().includes('güvenlik') || h.name.toLowerCase().includes('titan') || h.id.includes('h2'));
        }
      }
      if (!handle) handle = handles[0];
      if (handle) setSelectedHandle(handle.id);
    }

    // Hinges or Rollers
    if (systemType === 'hinged') {
      const hinges = accessories.filter(a => a.type === 'hinge' && (a.compatibility === 'both' || a.compatibility === systemType || !a.compatibility));
      if (hinges.length > 0) {
        let hinge = null;
        if (packType === 'standard') {
          hinge = hinges.find(h => h.name.toLowerCase().includes('standart') || h.name.toLowerCase().includes('favorit') || (h.maxWeightKg && h.maxWeightKg <= 80));
        } else if (packType === 'premium') {
          hinge = hinges.find(h => h.name.toLowerCase().includes('gizli') || h.name.toLowerCase().includes('axxent') || h.name.toLowerCase().includes('axxyent') || h.id.includes('hi3'));
        } else {
          hinge = [...hinges].sort((a,b) => (b.maxWeightKg || 0) - (a.maxWeightKg || 0))[0];
        }
        if (!hinge) hinge = hinges[0];
        if (hinge) setSelectedHinge(hinge.id);
      }
    } else {
      const rollers = accessories.filter(a => a.type === 'other' && (a.compatibility === 'both' || a.compatibility === systemType || !a.compatibility));
      if (rollers.length > 0) {
        let roller = null;
        if (packType === 'standard') {
          roller = rollers.find(r => r.name.toLowerCase().includes('eco') || r.name.toLowerCase().includes('standart') || (r.maxWeightKg && r.maxWeightKg <= 100));
        } else if (packType === 'premium') {
          roller = rollers.find(r => r.name.toLowerCase().includes('tandem') || r.name.toLowerCase().includes('150') || r.name.toLowerCase().includes('200') || r.id.includes('sr2'));
        } else {
          roller = [...rollers].sort((a,b) => (b.maxWeightKg || 0) - (a.maxWeightKg || 0))[0];
        }
        if (!roller) roller = rollers[0];
        if (roller) setSelectedOther(roller.id);
      }
    }

    // Lock
    const locks = accessories.filter(a => a.type === 'lock' && (a.compatibility === 'both' || a.compatibility === systemType || !a.compatibility));
    if (locks.length > 0) {
      let lock = null;
      if (packType === 'standard') {
        lock = locks.find(l => !l.name.toLowerCase().includes('3 n') && !l.name.toLowerCase().includes('çok n') && !l.name.toLowerCase().includes('multi') && !l.name.toLowerCase().includes('titan'));
      } else {
        lock = locks.find(l => l.name.toLowerCase().includes('3') || l.name.toLowerCase().includes('kilit takımı') || l.name.toLowerCase().includes('multi') || l.name.toLowerCase().includes('titan') || l.id.includes('l1'));
      }
      if (!lock) lock = locks[0];
      if (lock) setSelectedLock(lock.id);
    }

    // Automation
    if (packType === 'heavyduty') {
      const auto = accessories.find(a => a.type === 'automation' && (a.compatibility === 'both' || a.compatibility === systemType || !a.compatibility));
      if (auto) setSelectedAutomation(auto.id);
    } else {
      setSelectedAutomation('');
    }

    // Special door accessories
    if (systemType === 'hinged' && packType === 'heavyduty') {
      const closer = accessories.find(a => a.type === 'doorCloser' && (a.compatibility === 'both' || a.compatibility === systemType || !a.compatibility));
      if (closer) setSelectedDoorCloser(closer.id);
      const kp = accessories.find(a => a.type === 'kickplate' && (a.compatibility === 'both' || a.compatibility === systemType || !a.compatibility));
      if (kp) setSelectedKickplate(kp.id);
    } else {
      setSelectedDoorCloser('');
      setSelectedKickplate('');
    }
  };

  const AccessorySelect = ({ label, type, value, onChange }: { label: string, type: Accessory['type'], value: string, onChange: (val: string) => void }) => {
    const filtered = accessories.filter(a => 
      a.type === type && 
      (a.compatibility === 'both' || a.compatibility === selectedSystem.type || !a.compatibility)
    );
    
    const selectedAcc = accessories.find(a => a.id === value);
    const accImage = selectedAcc ? (customAccessoryImages[selectedAcc.id] || '') : '';

    return (
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{label}</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select 
              value={value} 
              onChange={e => {
                setActivePack(null);
                onChange(e.target.value);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pr-8 text-xs text-white outline-none focus:border-blue-500/50 appearance-none"
            >
              <option value="">{t(lang, 'selectAccessories')}</option>
              {filtered.map(acc => {
                const isHingeType = acc.type === 'hinge';
                const isRollerType = acc.type === 'other' && selectedSystem.type === 'sliding';
                
                let suffix = '';
                let isInsufficient = false;
                
                if ((isHingeType || isRollerType) && acc.maxWeightKg) {
                  if (acc.maxWeightKg < totalGlassWeight) {
                    isInsufficient = true;
                    suffix = lang === 'tr' 
                      ? ` - ⚠️ KAPASİTE Yetersiz (Max: ${acc.maxWeightKg} kg)` 
                      : ` - ⚠️ CAPACITY Insufficient (Max: ${acc.maxWeightKg} kg)`;
                  } else {
                    const isRec = isHingeType 
                      ? recommendedHinge?.id === acc.id 
                      : recommendedRoller?.id === acc.id;
                    if (isRec) {
                      suffix = lang === 'tr' ? ' - [⭐ ÖNERİLEN]' : ' - [⭐ RECOMMENDED]';
                    }
                  }
                }
                const displayText = `${acc.name} (${acc.price} USD)${suffix}`;
                return (
                  <option key={acc.id} value={acc.id} className={isInsufficient ? 'text-red-500 font-bold bg-red-950/20' : ''}>
                    {displayText}
                  </option>
                );
              })}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
               <ChevronUp size={12} className="rotate-180" />
            </div>
          </div>

          {selectedAcc && (
            <button
              type="button"
              onClick={() => setAccessoryImageModal({ isOpen: true, accessory: selectedAcc })}
              className={`w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center transition-all overflow-hidden ${
                accImage 
                  ? 'border-blue-500/50 bg-white hover:border-blue-400' 
                  : 'border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white'
              }`}
              title={lang === 'tr' ? 'Aksesuar Resmi Yükle / Gör' : 'Upload / View Accessory Image'}
            >
              {accImage ? (
                <img src={accImage} alt={selectedAcc.name} className="w-full h-full object-contain" />
              ) : (
                <Camera size={16} />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const currentFrameWidth = selectedSystem?.frameWidth || 55;
  const selectedBounds = selectedNodeId ? getNodeBounds(rootNode, selectedNodeId, width, height, currentFrameWidth) : null;
  const isVerticalSplit = selectedNode?.direction === 'vertical';
  const containerW = selectedBounds ? selectedBounds.w : width;
  const containerH = selectedBounds ? selectedBounds.h : height;
  const totalDim = isVerticalSplit ? containerW : containerH;
  
  // Exact axis-to-axis dimension of each segment matching CAD drawing
  const r0 = selectedNode?.splitRatio?.[0] ?? 0.5;
  const availDim = Math.max(1, totalDim - currentFrameWidth);
  const size1 = selectedNode ? (availDim * r0 + currentFrameWidth / 2) : 0;
  const size2 = selectedNode ? (totalDim - size1) : 0;

  const formatSize = (num: number) => {
    const rounded = Number(num.toFixed(1));
    if (lang === 'tr') {
      return rounded.toString().replace('.', ',');
    }
    return rounded.toString();
  };

  useEffect(() => {
    if (selectedNode?.type === 'container') {
      const parsed1 = parseFloat(inputVal1.replace(',', '.'));
      const parsed2 = parseFloat(inputVal2.replace(',', '.'));
      
      const diff1 = Math.abs((isNaN(parsed1) ? 0 : parsed1) - size1);
      const diff2 = Math.abs((isNaN(parsed2) ? 0 : parsed2) - size2);
      
      if (isNaN(parsed1) || diff1 > 0.05) {
        setInputVal1(formatSize(size1));
      }
      if (isNaN(parsed2) || diff2 > 0.05) {
        setInputVal2(formatSize(size2));
      }
    }
  }, [selectedNodeId, size1, size2, selectedNode?.type]);

  const handleUpdateSplitSize = (index: number, val: number) => {
    if (!selectedNodeId || !selectedNode) return;
    const bounds = getNodeBounds(rootNode, selectedNode.id, width, height, currentFrameWidth);
    const isVertical = selectedNode.direction === 'vertical';
    const totalDimVal = isVertical ? (bounds ? bounds.w : width) : (bounds ? bounds.h : height);
    if (totalDimVal <= currentFrameWidth + 10) return;

    const availDim = totalDimVal - currentFrameWidth;
    let targetSpan1 = val;
    if (index === 0) {
      targetSpan1 = val;
    } else {
      targetSpan1 = totalDimVal - val;
    }

    // Solve for ratio0: targetSpan1 = availDim * ratio0 + currentFrameWidth / 2
    let ratio0 = (targetSpan1 - currentFrameWidth / 2) / availDim;
    ratio0 = Math.max(0.01, Math.min(0.99, ratio0));
    handleUpdateSplitRatio(ratio0);
  };

  const currentUnitFor3D: Unit = {
    id: 'temp',
    name, width, height, system: systemId,
    color, specificColor, glassType: glassTypeId, glassThickness: 24,
    rootNode, quantity, shape, archHeight, hasThreshold, includeGlass,
    customGlassPrice: customGlassPriceInput.trim() !== '' ? Number(customGlassPriceInput) : undefined,
    viewPerspective
  };

  // Check if any part is openable for section view
  const hasOpeningPart = (node: WindowNode): boolean => {
    if (node.openingType && node.openingType !== 'fixed') return true;
    if (node.children) return node.children.some(hasOpeningPart);
    return false;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-xl z-20">
        <div className="flex items-center gap-6">
            <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><ArrowLeft size={20} /></button>
            <div className="flex flex-col">
              <input value={name} onChange={e => setName(e.target.value)} className="bg-transparent border-none text-lg font-bold focus:ring-0 outline-none text-white p-0 h-6" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t(lang, 'unitEditor')}</span>
            </div>
        </div>
        <div className="flex gap-3 items-center">
            {/* Hızlı Kanat Yönü Değiştirme Butonu */}
            <button 
              type="button" 
              onClick={handleSwapSashes}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-900/30 border border-blue-400/30"
              title={lang === 'tr' ? 'Sağ ve sol kanatların yerini ve açılım yönünü tersine çevirir (Sağ ⇄ Sol)' : 'Swap left and right sashes (Left ⇄ Right)'}
            >
              <ArrowLeftRight size={16} className="text-white" />
              <span>{lang === 'tr' ? 'Kanatları Değiştir (Sağ ⇄ Sol)' : 'Swap Sashes (Left ⇄ Right)'}</span>
            </button>

            {onToggleTheme && (
              <button 
                onClick={onToggleTheme} 
                className="p-1.5 text-slate-400 hover:text-white transition-colors border border-white/5 rounded flex items-center justify-center px-3"
                title={theme === 'light' ? (lang === 'tr' ? 'Karanlık Tema' : 'Dark Theme') : (lang === 'tr' ? 'Aydınlık Tema' : 'Light Theme')}
              >
                {theme === 'light' ? <Moon size={16} className="text-slate-500 hover:text-indigo-500" /> : <Sun size={16} className="text-amber-400" />}
              </button>
            )}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-white/5 mr-4">
              <button onClick={() => setViewMode('2d')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${viewMode === '2d' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                <Monitor size={14} /> {t(lang, 'view2D')}
              </button>
              <button onClick={() => setViewMode('3d')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${viewMode === '3d' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                <BoxSelect size={14} /> {t(lang, 'preview3D')}
              </button>
            </div>
            <button onClick={handleUndo} disabled={history.length === 0} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl font-bold flex items-center gap-2 transition-all border border-white/5">
              <Undo2 size={18} /> {t(lang, 'undo')}
            </button>
            {initialUnit && (
              <button 
                type="button"
                onClick={handleSaveAsNew} 
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30 border border-emerald-400/30"
                title={lang === 'tr' ? 'Bu pozisyonun birebir kopyasını oluşturup yeni poz olarak kaydeder' : 'Duplicate as a new position'}
              >
                <Copy size={18} /> {lang === 'tr' ? 'Farklı Kaydet (Yeni Poz)' : 'Save as New'}
              </button>
            )}
            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20">
              <Save size={18} /> {t(lang, 'saveUnit')}
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-white/5 bg-slate-900/40 p-5 overflow-y-auto space-y-8 custom-scrollbar">
            <section>
                <div className="flex items-center gap-2 mb-4">
                  <Ruler size={14} className="text-blue-500" />
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(lang, 'dimensions')} & {t(lang, 'quantity')}</h3>
                </div>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                            <label className="block text-[9px] text-slate-500 mb-0.5 uppercase">{t(lang, 'width')}</label>
                            <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="bg-transparent text-white font-mono font-bold w-full outline-none text-sm" />
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                            <label className="block text-[9px] text-slate-500 mb-0.5 uppercase">{t(lang, 'height')}</label>
                            <input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} className="bg-transparent text-white font-mono font-bold w-full outline-none text-sm" />
                        </div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                        <label className="block text-[9px] text-slate-500 mb-0.5 uppercase">{t(lang, 'quantity')}</label>
                        <div className="flex items-center gap-2">
                           <input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="bg-transparent text-blue-400 font-mono font-bold w-full outline-none text-sm" />
                           <span className="text-[10px] text-slate-600 font-bold uppercase">{t(lang, 'unitPce')}</span>
                        </div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                        <label className="block text-[9px] text-slate-500 mb-1.5 uppercase">{lang === 'tr' ? 'Bakış Açısı / Görünüm' : 'View Perspective'}</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            type="button"
                            onClick={() => setViewPerspective('interior')} 
                            className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${viewPerspective === 'interior' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 font-black' : 'bg-slate-950 border-white/5 text-slate-500'}`}
                          >
                            🚪 {lang === 'tr' ? 'İçten (Standart)' : 'Interior (Std)'}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setViewPerspective('exterior')} 
                            className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${viewPerspective === 'exterior' ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-black' : 'bg-slate-950 border-white/5 text-slate-500'}`}
                          >
                            🌳 {lang === 'tr' ? 'Dıştan' : 'Exterior'}
                          </button>
                        </div>
                    </div>
                    <div className="space-y-3 pt-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{t(lang, 'shape')}</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => setShape('rect')} className={`flex flex-col items-center p-2 rounded-xl border transition-all ${shape === 'rect' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                            <Square size={16} className="mb-1" /><span className="text-[8px] font-bold uppercase">{t(lang, 'rect')}</span>
                          </button>
                          <button onClick={() => setShape('triangle')} className={`flex flex-col items-center p-2 rounded-xl border transition-all ${shape === 'triangle' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                            <Triangle size={16} className="mb-1" /><span className="text-[8px] font-bold uppercase">{t(lang, 'triangle')}</span>
                          </button>
                          <button onClick={() => setShape('arch')} className={`flex flex-col items-center p-2 rounded-xl border transition-all ${shape === 'arch' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                            <Circle size={16} className="mb-1" /><span className="text-[8px] font-bold uppercase">{t(lang, 'arch')}</span>
                          </button>
                        </div>
                    </div>
                    {shape === 'arch' && (
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-1">
                          <label className="block text-[9px] text-slate-500 mb-0.5 uppercase">{t(lang, 'archHeight')}</label>
                          <input type="number" value={archHeight} onChange={e => setArchHeight(Number(e.target.value))} className="bg-transparent text-white font-mono font-bold w-full outline-none text-sm" />
                      </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{lang === 'tr' ? 'Profil Renk Grubu' : 'Profile Color Group'}</label>
                        <select value={color} onChange={e => setColor(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none appearance-none">
                          {COLOR_GROUPS.map(c => (
                            <option key={c.id} value={c.id}>
                              {lang === 'tr' ? c.nameTr : c.nameEn}
                            </option>
                          ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">
                          {lang === 'tr' ? 'Proje Renk Kodu (Teklifte Görünür)' : 'Project Color Code (Visible on Quote)'}
                        </label>
                        <input 
                          type="text" 
                          value={specificColor} 
                          onChange={e => setSpecificColor(e.target.value)} 
                          placeholder={lang === 'tr' ? 'Örn: RAL 7016' : 'e.g. RAL 7016'} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block ml-1">{t(lang, 'glassType')}</label>
                        <select value={glassTypeId} onChange={e => setGlassTypeId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none appearance-none">
                          {GLASS_TYPES.map(g => <option key={g.id} value={g.id}>{g.name} ({g.thickness}mm)</option>)}
                        </select>
                    </div>

                    {/* Dynamic Glass Price and Inclusion Options */}
                    <div className="p-3 bg-slate-950/70 border border-white/5 rounded-xl space-y-3 transition-colors">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={includeGlass} 
                          onChange={e => setIncludeGlass(e.target.checked)} 
                          className="rounded border-slate-800 bg-slate-950 text-blue-650 focus:ring-0 w-4 h-4 outline-none cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-slate-100">
                            {lang === 'tr' ? 'Cam Dahil' : 'Include Glass'}
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium leading-tight">
                            {lang === 'tr' ? 'Cam fiyatını maliyet ve fiyat teklifine dahil eder' : 'Includes glass pricing in cost and quotation calculations'}
                          </span>
                        </div>
                      </label>

                      {includeGlass && (
                        <div className="pt-2 border-t border-white/5 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block">
                            {lang === 'tr' ? 'Özel Cam m² Fiyatı (TL)' : 'Custom Glass Price per m² ($)'} 
                            <span className="text-[9px] text-blue-400 normal-case ml-1 font-medium">
                              ({lang === 'tr' ? 'Boş ise katalog fiyatı' : 'Leave empty for default catalog'})
                            </span>
                          </label>
                          <input 
                            type="number" 
                            value={customGlassPriceInput} 
                            placeholder={(() => {
                              const selectedGlassObj = GLASS_TYPES.find(g => g.id === glassTypeId);
                              return selectedGlassObj ? `${selectedGlassObj.pricePerSqm} TL` : '65';
                            })()}
                            onChange={e => setCustomGlassPriceInput(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-blue-500/50"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      )}
                    </div>

                    {/* POSITION CUSTOM CATALOG SECTION DRAWINGS */}
                    <div className="p-4 bg-slate-900 border border-slate-700/60 rounded-xl space-y-4 transition-all shadow-sm">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-blue-400 shrink-0" />
                          <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-widest">
                            {lang === 'tr' ? 'Teklif Plan & Detay Çizimleri' : 'Quote Plan & Section Drawings'}
                          </h4>
                        </div>

                        {selectedSystem && (
                          <button
                            type="button"
                            onClick={() => {
                              const planUrl = selectedSystem.planSectionUrl || selectedSystem.framePlanSectionUrl || '';
                              const planCode = selectedSystem.planSectionProfileCode || selectedSystem.framePlanSectionProfileCode || '';
                              const crossUrl = selectedSystem.crossSectionUrl || selectedSystem.frameCrossSectionUrl || '';
                              const crossCode = selectedSystem.crossSectionProfileCode || selectedSystem.frameCrossSectionProfileCode || '';

                              if (planUrl) setPlanSectionUrl(planUrl);
                              if (planCode) setPlanSectionProfileCode(planCode);
                              if (crossUrl) setCrossSectionUrl(crossUrl);
                              if (crossCode) setCrossSectionProfileCode(crossCode);
                            }}
                            className="px-2.5 py-1 bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
                            title={lang === 'tr' ? 'Ayarlar > Sistem Yapılandırması sayfasındaki varsayılan kesitleri bu poza aktarır' : 'Loads default drawings from System Configurations into this unit'}
                          >
                            <Sparkles size={12} className="text-blue-400" />
                            {lang === 'tr' ? 'Sistem Kütüphanesinden Getir' : 'Load From System Library'}
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                        {lang === 'tr' 
                          ? 'Bu poz için teklif çıktısında gösterilecek dikey ve yatay kesit resimlerini doğrudan yükleyebilir veya Sistem Kütüphanesinden tek tıkla çekebilirsiniz.'
                          : 'Upload custom cross-section & plan drawings for this unit or pull them instantly from the System Library.'}
                      </p>

                      {/* System Library Automatic Fallback Status Notice */}
                      {selectedSystem && (selectedSystem.planSectionUrl || selectedSystem.crossSectionUrl || selectedSystem.framePlanSectionUrl) && !planSectionUrl && !crossSectionUrl && (
                        <div className="p-2.5 bg-blue-950/40 border border-blue-500/25 rounded-xl text-[10px] text-blue-300 flex items-center gap-2">
                          <Sparkles size={13} className="text-blue-400 shrink-0" />
                          <span>
                            {lang === 'tr' 
                              ? `Kütüphane Bağlantılı: Seçili sistem (${selectedSystem.name}) için tanımlı kütüphane kesitleri teklifte otomatik kullanılacaktır.` 
                              : `Library Linked: Default section drawings for ${selectedSystem.name} will automatically appear in quotes.`}
                          </span>
                        </div>
                      )}

                      {/* PLAN SECTION */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-extrabold text-slate-200 uppercase block ml-1">
                            {lang === 'tr' ? 'Plan Kesiti (Yatay)' : 'Plan Section (Horizontal)'}
                          </label>
                          {planSectionUrl && (
                            <button 
                              type="button"
                              onClick={() => {
                                setPlanSectionUrl('');
                                setPlanSectionProfileCode('');
                              }}
                              className="text-[9px] text-red-450 hover:text-red-400 font-bold uppercase transition-colors"
                            >
                              {lang === 'tr' ? 'Kaldır' : 'Clear'}
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input 
                              type="text"
                              value={planSectionProfileCode}
                              onChange={e => setPlanSectionProfileCode(e.target.value)}
                              placeholder={lang === 'tr' ? 'Profil Kodu (Örn: P-101)' : 'Profile Code (e.g., P-101)'}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder:text-slate-400 outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="relative">
                            <input 
                              type="file"
                              accept="image/*"
                              id="pos-plan-upload"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const res = await compressProfileImage(file);
                                    setPlanSectionUrl(res.base64);
                                  } catch (err) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      if (typeof reader.result === 'string') {
                                        setPlanSectionUrl(reader.result);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }
                              }}
                            />
                            <button 
                              type="button"
                              onClick={() => document.getElementById('pos-plan-upload')?.click()}
                              className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all ${
                                planSectionUrl 
                                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' 
                                  : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-200'
                              }`}
                            >
                              {planSectionUrl ? (lang === 'tr' ? 'Yüklendi ✓' : 'Uploaded ✓') : (lang === 'tr' ? 'Yükle' : 'Upload')}
                            </button>
                          </div>
                        </div>
                        {planSectionUrl && (
                          <div className="mt-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800/80 flex justify-center max-h-24 overflow-hidden">
                            <img src={planSectionUrl} alt="Plan Preview" className="max-h-20 object-contain" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>

                      {/* CROSS SECTION */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-extrabold text-slate-200 uppercase block ml-1">
                            {lang === 'tr' ? 'Dikey Kesit / Detay (Boy)' : 'Cross Section / Detail (Vertical)'}
                          </label>
                          {crossSectionUrl && (
                            <button 
                              type="button"
                              onClick={() => {
                                setCrossSectionUrl('');
                                setCrossSectionProfileCode('');
                              }}
                              className="text-[9px] text-red-450 hover:text-red-400 font-bold uppercase transition-colors"
                            >
                              {lang === 'tr' ? 'Kaldır' : 'Clear'}
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input 
                              type="text"
                              value={crossSectionProfileCode}
                              onChange={e => setCrossSectionProfileCode(e.target.value)}
                              placeholder={lang === 'tr' ? 'Profil Kodu (Örn: B-201)' : 'Profile Code (e.g., B-201)'}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder:text-slate-400 outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="relative">
                            <input 
                              type="file"
                              accept="image/*"
                              id="pos-cross-upload"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const res = await compressProfileImage(file);
                                    setCrossSectionUrl(res.base64);
                                  } catch (err) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      if (typeof reader.result === 'string') {
                                        setCrossSectionUrl(reader.result);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }
                              }}
                            />
                            <button 
                              type="button"
                              onClick={() => document.getElementById('pos-cross-upload')?.click()}
                              className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all ${
                                crossSectionUrl 
                                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' 
                                  : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-200'
                              }`}
                            >
                              {crossSectionUrl ? (lang === 'tr' ? 'Yüklendi ✓' : 'Uploaded ✓') : (lang === 'tr' ? 'Yükle' : 'Upload')}
                            </button>
                          </div>
                        </div>
                        {crossSectionUrl && (
                          <div className="mt-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800/80 flex justify-center max-h-24 overflow-hidden">
                            <img src={crossSectionUrl} alt="Cross Preview" className="max-h-20 object-contain" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                        <div className="space-y-1.5 pb-2.5 border-b border-white/5 mb-2.5 pt-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block ml-1 tracking-wider">
                               {lang === 'tr' ? '1. Ürün Tipolojisi Seçin' : '1. Choose Product Typology'}
                            </label>
                            
                            {/* Görsel Teknik Çizim Gridi */}
                            <div className="grid grid-cols-3 gap-1.5 max-h-[300px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                              {TYPOLOGIES_LIST.map(typo => {
                                const active = selectedTypology === typo.id;
                                return (
                                  <button
                                    key={typo.id}
                                    type="button"
                                    onClick={() => handleTypologySelect(typo.id)}
                                    className={`relative flex flex-col items-center justify-between p-2 rounded-xl border text-left transition-all duration-200 group ${
                                      active 
                                        ? 'border-blue-500/80 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)] text-blue-400' 
                                        : 'border-slate-850 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/50 text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    {/* Seçili ise sağ üstte minik onay işareti */}
                                    {active && (
                                      <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5 animate-in zoom-in-50 duration-150">
                                        <Check size={8} strokeWidth={3} />
                                      </div>
                                    )}
                                    
                                    {/* SVG Çizim */}
                                    <div className="mb-1.5 p-1 rounded-lg bg-black/10 group-hover:scale-105 transition-transform">
                                      {typo.renderIcon(active)}
                                    </div>
                                    
                                    {/* İsim */}
                                    <span className={`text-[9px] text-center font-bold tracking-tight leading-none block w-full truncate ${
                                      active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                                    }`} title={lang === 'tr' ? typo.nameTr : typo.nameEn}>
                                      {lang === 'tr' ? typo.nameTr : typo.nameEn}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                        </div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block ml-1">{t(lang, 'profileSystem')}</label>
                        <div className="flex gap-2">
                            <select value={systemId} onChange={e => handleSystemSelect(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none appearance-none">
                            {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <button 
                                type="button"
                                onClick={() => setShowSection(true)}
                                className="p-2.5 bg-slate-800 hover:bg-blue-600/20 border border-white/5 rounded-xl text-blue-400 transition-all"
                                title={t(lang, 'sectionDetail')}
                            >
                                <Layers size={16} />
                            </button>
                        </div>

                        {/* DETAYLI PROFİL KOD SEÇİMİ (SEÇİLEN SİSTEM KATALOĞU VARSA VEYA MANUEL GİRİŞ) */}
                        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 mt-3 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="text-amber-500 w-4 h-4 animate-pulse" />
                            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                              {currentCatalog 
                                ? (systemId === 'kurt-51ls' || systemId.includes('51ls')
                                  ? (lang === 'tr' ? '51LS Detaylı Profil Kataloğu' : '51LS Detailed Profile Selection')
                                  : (systemId === 'kurt-ktr-64t' || systemId.includes('64t'))
                                    ? (lang === 'tr' ? 'KTR 64T Detaylı Profil Kataloğu' : 'KTR 64T Detailed Profile Selection')
                                    : (systemId === 'kurt-70t-th' || systemId.includes('70t'))
                                      ? (lang === 'tr' ? '70T-TH Detaylı Profil Kataloğu' : '70T-TH Detailed Profile Selection')
                                      : (lang === 'tr' ? `${selectedSystem?.name || ''} Profil Kataloğu` : `${selectedSystem?.name || ''} Profile Catalog`))
                                : (lang === 'tr' ? 'Detaylı Profil Kod ve Kesit Çizimleri' : 'Detailed Profile Codes & Section Drawings')}
                            </h4>
                          </div>
                          
                          {/* KASA SEÇİMİ */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block ml-1">
                              {lang === 'tr' ? 'Kasa Profili' : 'Frame Profile'}
                            </label>
                            <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                              <ProfilePreviewAndUpload 
                                code={selectedFrameProfile} 
                                type="frame" 
                                imageUrl={selectedFrameProfileImage} 
                                onImageUploaded={(b64) => handleProfileImageUploaded(selectedFrameProfile, b64)} 
                                onImageCleared={() => handleProfileImageCleared(selectedFrameProfile)} 
                                lang={lang} 
                                systemDrawings={selectedSystem?.profileDrawings}
                              />
                              <div className="flex-1 min-w-0">
                                {currentCatalog ? (
                                  <>
                                    <select 
                                      value={selectedFrameProfile} 
                                      onChange={e => setSelectedFrameProfile(e.target.value)} 
                                      className="w-full bg-transparent border-none text-xs text-white font-semibold outline-none cursor-pointer focus:ring-0 p-0"
                                    >
                                      {currentCatalog.filter(x => x.type === 'frame').map(item => (
                                        <option key={item.code} value={item.code} className="bg-slate-950 text-white">
                                          {item.code} ({lang === 'tr' ? item.nameTr : item.nameEn})
                                        </option>
                                      ))}
                                    </select>
                                    <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                      {lang === 'tr' ? 'Ağırlık' : 'Weight'}: {currentCatalog.find(x => x.code === selectedFrameProfile)?.weight} kg/m
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <input 
                                      type="text"
                                      value={selectedFrameProfile}
                                      onChange={e => setSelectedFrameProfile(e.target.value)}
                                      placeholder={lang === 'tr' ? 'Kasa Kodu Girin...' : 'Enter Frame Code...'}
                                      className="w-full bg-transparent border-none text-xs text-white font-semibold outline-none focus:ring-0 p-0 font-mono"
                                    />
                                    <div className="text-[9px] text-slate-500 mt-0.5 font-medium">
                                      {lang === 'tr' ? 'Örn: B-101 / Kasa Profili Kesiti Yükleyin' : 'e.g. B-101 / Upload Frame Section'}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* KANAT SEÇİMİ */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block ml-1">
                              {lang === 'tr' ? 'Kanat Profili' : 'Sash Profile'}
                            </label>
                            <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                              <ProfilePreviewAndUpload 
                                code={selectedSashProfile} 
                                type="sash" 
                                imageUrl={selectedSashProfileImage} 
                                onImageUploaded={(b64) => handleProfileImageUploaded(selectedSashProfile, b64)} 
                                onImageCleared={() => handleProfileImageCleared(selectedSashProfile)} 
                                lang={lang} 
                                systemDrawings={selectedSystem?.profileDrawings}
                              />
                              <div className="flex-1 min-w-0">
                                {currentCatalog ? (
                                  <>
                                    <select 
                                      value={selectedSashProfile} 
                                      onChange={e => setSelectedSashProfile(e.target.value)} 
                                      className="w-full bg-transparent border-none text-xs text-white font-semibold outline-none cursor-pointer focus:ring-0 p-0"
                                    >
                                      {currentCatalog.filter(x => x.type === 'sash').map(item => (
                                        <option key={item.code} value={item.code} className="bg-slate-950 text-white">
                                          {item.code} ({lang === 'tr' ? item.nameTr : item.nameEn})
                                        </option>
                                      ))}
                                    </select>
                                    <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                      {lang === 'tr' ? 'Ağırlık' : 'Weight'}: {currentCatalog.find(x => x.code === selectedSashProfile)?.weight} kg/m
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <input 
                                      type="text"
                                      value={selectedSashProfile}
                                      onChange={e => setSelectedSashProfile(e.target.value)}
                                      placeholder={lang === 'tr' ? 'Kanat Kodu Girin...' : 'Enter Sash Code...'}
                                      className="w-full bg-transparent border-none text-xs text-white font-semibold outline-none focus:ring-0 p-0 font-mono"
                                    />
                                    <div className="text-[9px] text-slate-500 mt-0.5 font-medium">
                                      {lang === 'tr' ? 'Örn: B-201 / Kanat Profili Kesiti Yükleyin' : 'e.g. B-201 / Upload Sash Section'}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* ORTA KAYIT SEÇİMİ */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block ml-1">
                              {lang === 'tr' ? 'Orta Kayıt Profili' : 'Mullion Profile'}
                            </label>
                            <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                              <ProfilePreviewAndUpload 
                                code={selectedMullionProfile} 
                                type="mullion" 
                                imageUrl={selectedMullionProfileImage} 
                                onImageUploaded={(b64) => handleProfileImageUploaded(selectedMullionProfile, b64)} 
                                onImageCleared={() => handleProfileImageCleared(selectedMullionProfile)} 
                                lang={lang} 
                                systemDrawings={selectedSystem?.profileDrawings}
                              />
                              <div className="flex-1 min-w-0">
                                {currentCatalog ? (
                                  <>
                                    <select 
                                      value={selectedMullionProfile} 
                                      onChange={e => setSelectedMullionProfile(e.target.value)} 
                                      className="w-full bg-transparent border-none text-xs text-white font-semibold outline-none cursor-pointer focus:ring-0 p-0"
                                    >
                                      {currentCatalog.filter(x => x.type === 'mullion').map(item => (
                                        <option key={item.code} value={item.code} className="bg-slate-950 text-white">
                                          {item.code} ({lang === 'tr' ? item.nameTr : item.nameEn})
                                        </option>
                                      ))}
                                    </select>
                                    <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                      {lang === 'tr' ? 'Ağırlık' : 'Weight'}: {currentCatalog.find(x => x.code === selectedMullionProfile)?.weight} kg/m
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <input 
                                      type="text"
                                      value={selectedMullionProfile}
                                      onChange={e => setSelectedMullionProfile(e.target.value)}
                                      placeholder={lang === 'tr' ? 'Orta Kayıt Kodu Girin...' : 'Enter Mullion Code...'}
                                      className="w-full bg-transparent border-none text-xs text-white font-semibold outline-none focus:ring-0 p-0 font-mono"
                                    />
                                    <div className="text-[9px] text-slate-500 mt-0.5 font-medium">
                                      {lang === 'tr' ? 'Örn: B-301 / Orta Kayıt Kesiti Yükleyin' : 'e.g. B-301 / Upload Mullion Section'}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                    </div>
                    
                    <div className="pt-1.5">
                        <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950 hover:bg-slate-900 border border-white/5 rounded-xl p-3 text-xs text-white select-none transition-all">
                            <input 
                              type="checkbox" 
                              checked={hasThreshold} 
                              onChange={e => setHasThreshold(e.target.checked)} 
                              className="rounded border-slate-800 bg-slate-950 text-blue-650 focus:ring-0 w-4 h-4 outline-none cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className="font-bold">{lang === 'tr' ? 'Alüminyum Eşik' : 'Aluminum Threshold'}</span>
                              <span className="text-[10px] text-slate-500 font-medium leading-tight">
                                {lang === 'tr' ? 'Kasa yerine alt kısma mini eşik profili uygulanır' : 'Low profile bottom threshold instead of standard frame'}
                              </span>
                            </div>
                        </label>
                    </div>
                </div>
            </section>

            <section className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings2 size={14} className="text-blue-500" />
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(lang, 'selectedPane')}</h3>
                  </div>
                  {parentId && <button onClick={() => setSelectedNodeId(parentId)} className="p-1.5 hover:bg-slate-800 rounded-lg text-blue-400 transition-colors" title={t(lang, 'selectParent')}><ChevronUp size={14} /></button>}
                </div>
                {!selectedNodeId ? (
                  <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl text-center">
                    <MousePointer2 className="mx-auto mb-2 text-blue-500/40" size={20} />
                    <p className="text-[10px] text-slate-500 italic">{t(lang, 'selectPaneInfo')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedNode?.type === 'container' ? (
                      <div className="space-y-4 bg-slate-900/50 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Layout size={12} className="text-blue-400" />
                            <span className="text-[10px] font-bold uppercase text-slate-400">{t(lang, 'splitSizes')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-blue-400 font-bold font-mono bg-blue-950/80 px-2 py-0.5 rounded border border-blue-500/20">
                              {formatSize(containerW)} × {formatSize(containerH)} mm
                            </span>
                            <span className="text-[9px] text-slate-500 font-extrabold font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border border-white/5">
                              {selectedNode.direction === 'vertical' ? (lang === 'tr' ? 'Dikey Bölme' : 'Vertical Split') : (lang === 'tr' ? 'Yatay Bölme' : 'Horizontal Split')}
                            </span>
                          </div>
                        </div>
                        
                        {/* Manual Input Fields side by side */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase">
                              {selectedNode.direction === 'vertical'
                                ? (lang === 'tr' ? 'Sol Bölme (Y1)' : 'Left Width (W1)')
                                : (lang === 'tr' ? 'Üst Bölme (H1)' : 'Top Height (H1)')}
                            </label>
                            <div className="flex items-center gap-1.5 font-mono">
                              <input 
                                type="text" 
                                value={inputVal1} 
                                onChange={e => {
                                  const rawVal = e.target.value.replace(/[^\d.,]/g, '');
                                  setInputVal1(rawVal);
                                  const normalized = rawVal.replace(',', '.');
                                  const num = parseFloat(normalized);
                                  if (!isNaN(num) && num > 0) {
                                    handleUpdateSplitSize(0, num);
                                  }
                                }} 
                                className="bg-transparent text-white font-bold w-full outline-none text-xs focus:text-blue-400" 
                              />
                              <span className="text-[9px] text-slate-600 font-semibold uppercase">MM</span>
                            </div>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                            <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase">
                              {selectedNode.direction === 'vertical'
                                ? (lang === 'tr' ? 'Sağ Bölme (Y2)' : 'Right Width (W2)')
                                : (lang === 'tr' ? 'Alt Bölme (H2)' : 'Bottom Height (H2)')}
                            </label>
                            <div className="flex items-center gap-1.5 font-mono">
                              <input 
                                type="text" 
                                value={inputVal2} 
                                onChange={e => {
                                  const rawVal = e.target.value.replace(/[^\d.,]/g, '');
                                  setInputVal2(rawVal);
                                  const normalized = rawVal.replace(',', '.');
                                  const num = parseFloat(normalized);
                                  if (!isNaN(num) && num > 0) {
                                    handleUpdateSplitSize(1, num);
                                  }
                                }} 
                                className="bg-transparent text-white font-bold w-full outline-none text-xs focus:text-blue-400" 
                              />
                              <span className="text-[9px] text-slate-600 font-semibold uppercase">MM</span>
                            </div>
                          </div>
                        </div>

                        {/* Visual Range Slider for sliding control */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between text-[9px] font-semibold text-slate-500">
                            <span>{lang === 'tr' ? 'Sürgü ile ayarla' : 'Adjust with slider'}</span>
                            <span className="text-blue-400 font-mono">%{Math.round((selectedNode.splitRatio?.[0] || 0.5) * 100)}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.05" 
max="0.95" 
                            step="0.01" 
                            value={selectedNode.splitRatio?.[0] || 0.5} 
                            onChange={e => handleUpdateSplitRatio(Number(e.target.value))} 
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleSplit('vertical')} className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-white/5 group">
                          <SplitSquareHorizontal size={18} className="mb-1 text-slate-400 group-hover:text-blue-400" /><span className="text-[9px] font-bold uppercase tracking-tighter">{t(lang, 'splitVert')}</span>
                        </button>
                        <button onClick={() => handleSplit('horizontal')} className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-white/5 group">
                          <SplitSquareVertical size={18} className="mb-1 text-slate-400 group-hover:text-blue-400" /><span className="text-[9px] font-bold uppercase tracking-tighter">{t(lang, 'splitHorz')}</span>
                        </button>
                      </div>
                    )}
                    {selectedNode?.type !== 'container' && (
                      <div className="space-y-3 pt-2 border-t border-white/5">
                        {selectedBounds && (
                          <div className="flex items-center justify-between p-2 bg-slate-950/80 rounded-xl border border-white/5 text-xs">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              {lang === 'tr' ? 'Seçili Panel Boyutu' : 'Pane Size'}
                            </span>
                            <span className="font-mono font-bold text-blue-400">
                              {Math.round(selectedBounds.w)} × {Math.round(selectedBounds.h)} mm
                            </span>
                          </div>
                        )}
                        {parentId && (
                          <button
                            type="button"
                            onClick={() => setSelectedNodeId(parentId)}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 rounded-xl transition-all border border-blue-500/20 text-xs font-bold"
                          >
                            <Layout size={13} />
                            <span>{lang === 'tr' ? 'Bölme Ölçülerini Değiştir (Üst Bölme)' : 'Adjust Split Dimensions'}</span>
                          </button>
                        )}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                            {lang === 'tr' ? 'Bölme Tipi / Dolgusu' : 'Pane / Infill Type'}
                          </label>
                          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-white/5">
                            <button
                              type="button"
                              onClick={() => handleSetNodeType('glass')}
                              className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all text-center ${
                                selectedNode.type === 'glass' || (!selectedNode.type && selectedNode.openingType)
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {lang === 'tr' ? '🪟 Cam' : '🪟 Glass'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetNodeType('void')}
                              className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all text-center ${
                                selectedNode.type === 'void'
                                  ? 'bg-amber-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {lang === 'tr' ? '🔲 Boşluk' : '🔲 Void'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetNodeType('panel')}
                              className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all text-center ${
                                selectedNode.type === 'panel'
                                  ? 'bg-slate-700 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {lang === 'tr' ? '🪵 Panel' : '🪵 Panel'}
                            </button>
                          </div>
                        </div>

                        {selectedNode.type === 'void' ? (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-amber-400">
                              <Sparkles size={14} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                {lang === 'tr' ? 'LogiKal Uyumlu Duvar/Kiriş Boşluğu' : 'LogiKal Wall Opening (Void)'}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-relaxed">
                              {lang === 'tr'
                                ? 'Bu bölme boş bırakılmıştır (örneğin merdiven veya duvar açıklığı). Cam ve kanat profili maliyete ve kesim listesine dahil edilmez.'
                                : 'This section is marked as a void opening (e.g. stair/wall cutout). Glass and sashes are excluded from cut list and quotation.'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{t(lang, 'openingType')}</label>
                            <select value={selectedNode?.openingType || 'fixed'} onChange={e => handleSetOpening(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none appearance-none">
                              <option value="fixed">{t(lang, 'fixed')}</option>
                              <option value="turn-left">{t(lang, 'turnLeft')}</option>
                              <option value="turn-right">{t(lang, 'turnRight')}</option>
                              <option value="tilt">{t(lang, 'tilt')}</option>
                              <option value="tilt-turn-left">{t(lang, 'tiltTurnLeft')}</option>
                              <option value="tilt-turn-right">{t(lang, 'tiltTurnRight')}</option>
                              <option value="sliding">{t(lang, 'sliding')}</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                    {(rootNode.type === 'container' || selectedNode?.type === 'container' || parentId) && (
                      <button 
                        type="button" 
                        onClick={handleSwapSashes} 
                        className="w-full flex items-center justify-center gap-2 p-2.5 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 rounded-xl transition-all border border-blue-500/25 font-bold"
                        title={lang === 'tr' ? 'Sağ ve sol kanatların yerini ve açılımlarını tersine çevirir' : 'Swap left and right sashes'}
                      >
                        <ArrowLeftRight size={14} />
                        <span className="text-[10px] uppercase tracking-wider">{lang === 'tr' ? 'Kanatları Yer Değiştir (Sağ ⇄ Sol)' : 'Swap Sashes (Left ⇄ Right)'}</span>
                      </button>
                    )}
                    <button onClick={() => { setRootNode({ ...INITIAL_ROOT_NODE, id: uuidv4() }); setSelectedNodeId(null); }} className="w-full flex items-center justify-center gap-2 p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/20">
                      <Trash2 size={14} /><span className="text-[10px] font-bold uppercase tracking-wider">{t(lang, 'resetUnit')}</span>
                    </button>
                  </div>
                )}
            </section>
            <section className="pt-6 border-t border-white/5 pb-10">
                {/* Real-time Dynamic Glass Weight Info Card */}
                <div className="mb-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'tr' ? 'Hesaplanan Cam Ağırlığı' : 'Calculated Glass Weight'}</span>
                    </div>
                    <span className="text-lg font-black font-mono text-emerald-400">{totalGlassWeight.toFixed(2)} <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">KG</span></span>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5 space-y-1.5 text-[10px]">
                    <div className="flex justify-between items-center text-slate-400 font-medium">
                      <span>{lang === 'tr' ? 'Etkin Cam Kalınlığı:' : 'Active Glass Thickness:'}</span>
                      <span className="font-bold text-slate-200">{GLASS_TYPES.find(g => g.id === glassTypeId)?.thickness || 4} mm</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 font-medium">
                      <span>{lang === 'tr' ? 'Sistem Tipi:' : 'System Type:'}</span>
                      <span className="font-bold uppercase text-slate-200 tracking-wider text-[9px]">
                        {(() => {
                          const currentTypology = TYPOLOGIES_LIST.find(t => t.id === selectedTypology);
                          return currentTypology 
                            ? (lang === 'tr' ? currentTypology.nameTr : currentTypology.nameEn)
                            : (selectedSystem.type === 'hinged' ? (lang === 'tr' ? 'Menteşeli / Devrilmeli' : 'Hinged / Tilt') : (lang === 'tr' ? 'Sürme' : 'Sliding'));
                        })()}
                      </span>
                    </div>
                    {selectedSystem.type === 'hinged' && recommendedHinge && (
                      <div className="flex justify-between items-start text-slate-400 pt-1.5 border-t border-white/5">
                        <span className="mt-0.5">{lang === 'tr' ? 'Önerilen Menteşe:' : 'Recommended Hinge:'}</span>
                        <span className="font-extrabold text-blue-400 text-right max-w-[150px] leading-tight block">{recommendedHinge.name}</span>
                      </div>
                    )}
                    {selectedSystem.type === 'sliding' && recommendedRoller && (
                      <div className="flex justify-between items-start text-slate-400 pt-1.5 border-t border-white/5">
                        <span className="mt-0.5">{lang === 'tr' ? 'Önerilen Tekerlek:' : 'Recommended Roller:'}</span>
                        <span className="font-extrabold text-blue-400 text-right max-w-[150px] leading-tight block">{recommendedRoller.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hızlı Aksesuar Paketi Seçimi */}
                <div className="mb-6 bg-slate-950/40 border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-400 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {lang === 'tr' ? 'Hızlı Aksesuar Paketi Seç' : 'Quick Accessory Presets'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      type="button"
                      onClick={() => applyPresetPackage('standard')}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                        activePack === 'standard' 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-extrabold shadow-sm shadow-emerald-950' 
                          : 'bg-slate-900/60 border-white/5 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <Zap size={14} className={activePack === 'standard' ? 'text-emerald-400 mb-1' : 'text-slate-500 mb-1'} />
                      <span className="text-[10px] leading-tight font-bold">
                        {lang === 'tr' ? 'Standart' : 'Standard'}
                      </span>
                      <span className="text-[8px] text-slate-500 mt-0.5 leading-none block">
                        {selectedSystem.type === 'sliding' 
                          ? (lang === 'tr' ? 'Sürme' : 'Slide') 
                          : (lang === 'tr' ? 'Açılır' : 'Hinged')
                        }
                      </span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => applyPresetPackage('premium')}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                        activePack === 'premium' 
                          ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-extrabold shadow-sm shadow-blue-950' 
                          : 'bg-slate-900/60 border-white/5 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <Sparkles size={14} className={activePack === 'premium' ? 'text-blue-400 mb-1' : 'text-slate-500 mb-1'} />
                      <span className="text-[10px] leading-tight font-bold">
                        {lang === 'tr' ? 'Lüks & VIP' : 'Premium VIP'}
                      </span>
                      <span className="text-[8px] text-slate-500 mt-0.5 leading-none block">
                        {lang === 'tr' ? 'Kilitlemeli/Emniyet' : 'Max Security'}
                      </span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => applyPresetPackage('heavyduty')}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                        activePack === 'heavyduty' 
                          ? 'bg-purple-500/10 border-purple-500 text-purple-400 font-extrabold shadow-sm shadow-purple-950' 
                          : 'bg-slate-900/60 border-white/5 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <Package size={14} className={activePack === 'heavyduty' ? 'text-purple-400 mb-1' : 'text-slate-500 mb-1'} />
                      <span className="text-[10px] leading-tight font-bold">
                        {lang === 'tr' ? 'Ağır Hizmet' : 'Heavy Duty'}
                      </span>
                      <span className="text-[8px] text-slate-500 mt-0.5 leading-none block">
                        {lang === 'tr' ? 'Kapatıcı + Otomasyon' : 'Closer & Auto'}
                      </span>
                    </button>
                  </div>
                  
                  {activePack && (
                    <p className="text-[9px] text-slate-400 animate-fadeIn leading-relaxed border-t border-white/5 pt-2">
                      💡 {activePack === 'standard' && (
                        lang === 'tr' 
                          ? 'Standart Paket: Temel pencere kolu, standart menteşeler/makaralar, EPDM fitil ve standart kilit takımı otomatik uygulandı.' 
                          : 'Standard Package: Basic handle, standard hinges/rollers, EPDM gasket, and standard lock set applied.'
                      )}
                      {activePack === 'premium' && (
                        lang === 'tr' 
                          ? 'Lüks & VIP Paket: Siegenia Titan AF / emniyetli kilitlenebilir kollar, gizli/özel menteşeler, EPDM fitiller ve çok noktalı emniyet kilitleri uygulandı.' 
                          : 'Premium VIP Package: Siegenia Titan AF / high security lockable handles, heavy/concealed hinges, EPDM gaskets, and multi-point secure locks applied.'
                      )}
                      {activePack === 'heavyduty' && (
                        lang === 'tr' 
                          ? 'Ağır Hizmet Paketi: Maksimum taşıma gücüne sahip takviyeli menteşeler/makaralar, kapı kapatıcı pompalar, darbe plakaları ve otomasyon setleri uygulandı.' 
                          : 'Heavy Duty Package: Heavyweight reinforced hinges/rollers, door closers, kickplates, and smart automation units applied.'
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Wrench size={14} className="text-blue-500" />
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(lang, 'accessories')}</h3>
                </div>
                <div className="space-y-4">
                    <AccessorySelect label={t(lang, 'handle')} type="handle" value={selectedHandle} onChange={setSelectedHandle} />
                    {selectedSystem.type === 'sliding' ? (
                      <AccessorySelect label={lang === 'tr' ? 'Sürme Makaraları / Tekerlek' : 'Sliding Rollers / Wheels'} type="other" value={selectedOther} onChange={setSelectedOther} />
                    ) : (
                      <AccessorySelect label={t(lang, 'hinge')} type="hinge" value={selectedHinge} onChange={setSelectedHinge} />
                    )}
                    <AccessorySelect label={t(lang, 'gasket')} type="gasket" value={selectedGasket} onChange={setSelectedGasket} />
                    <AccessorySelect label={t(lang, 'lock')} type="lock" value={selectedLock} onChange={setSelectedLock} />
                    <AccessorySelect label={t(lang, 'corner')} type="corner" value={selectedCorner} onChange={setSelectedCorner} />
                    <AccessorySelect label={t(lang, 'automation')} type="automation" value={selectedAutomation} onChange={setSelectedAutomation} />
                    <AccessorySelect label={t(lang, 'kickplate')} type="kickplate" value={selectedKickplate} onChange={setSelectedKickplate} />
                </div>
            </section>
        </div>

        <div className={`flex-1 ${viewMode === '3d' ? 'bg-slate-100' : 'bg-slate-900'} relative flex items-center justify-center p-8 overflow-auto`} onClick={() => setSelectedNodeId(null)}>
             
             {/* Floating Toggle for View Perspective */}
             <div className="absolute top-6 right-6 flex items-center bg-slate-800/85 p-1.5 rounded-2xl border border-white/10 z-45 gap-1.5 backdrop-blur-md shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="text-[9px] font-black text-slate-400 px-2 uppercase tracking-widest">
                 {lang === 'tr' ? 'Görünüm:' : 'View:'}
               </div>
               <button 
                 type="button"
                 onClick={() => setViewPerspective('interior')} 
                 className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewPerspective === 'interior' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30' : 'text-slate-400 hover:text-slate-200'}`}
               >
                 🚪 {lang === 'tr' ? 'İçten (Standart)' : 'Interior (Std)'}
               </button>
               <button 
                 type="button"
                 onClick={() => setViewPerspective('exterior')} 
                 className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewPerspective === 'exterior' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30' : 'text-slate-400 hover:text-slate-200'}`}
               >
                 🌳 {lang === 'tr' ? 'Dıştan' : 'Exterior'}
               </button>
             </div>

             {/* Common Floating Zoom Controls */}
             <div className="absolute bottom-6 right-6 flex flex-col bg-slate-800 border border-white/10 rounded-2xl shadow-2xl p-2 z-40 gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => setVisualScale(Math.min(0.5, visualScale + 0.05))} className="p-2.5 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors" title="Zoom In"><ZoomIn size={18} /></button>
                <button onClick={() => setVisualScale(Math.max(0.05, visualScale - 0.05))} className="p-2.5 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors" title="Zoom Out"><ZoomOut size={18} /></button>
                <div className="h-px bg-white/5 mx-2 my-1" />
                <button onClick={() => setVisualScale(0.15)} className="p-2.5 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors" title="Fit to Screen"><Maximize size={18} /></button>
                <div className="text-[9px] font-black text-blue-400 text-center mt-1 uppercase tracking-tighter">%{Math.round(visualScale * 500)}</div>
             </div>

             {viewMode === '2d' ? (
               <div className="relative w-full h-full flex items-center justify-center min-h-[500px]">
                  <div className="absolute inset-0 bg-slate-100 opacity-[0.2] pointer-events-none" 
                        style={{ backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)', backgroundSize: '50px 50px' }} 
                  />
                  
                  {/* Floating Toggle for Vector vs Realistic Canvas */}
                  <div className="absolute top-6 left-6 flex items-center bg-slate-800/85 p-1.5 rounded-2xl border border-white/10 z-30 gap-1.5 backdrop-blur-md shadow-2xl" onClick={e => e.stopPropagation()}>
                    <button 
                      type="button"
                      onClick={() => setPreviewType('svg')} 
                      className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${previewType === 'svg' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 font-extrabold' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      <Layout size={12} />
                      {lang === 'tr' ? 'Vektör CAD' : 'Vector CAD'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setPreviewType('canvas');
                        setTimeout(drawCanvasPreview, 80);
                      }} 
                      className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${previewType === 'canvas' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 font-extrabold' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      <Sparkles size={12} className="text-amber-300" />
                      {lang === 'tr' ? 'Gerçekçi Tuval' : 'Realistic Canvas'}
                    </button>
                    {(rootNode.type === 'container' || selectedNode?.type === 'container' || parentId) && (
                      <button 
                        type="button"
                        onClick={handleSwapSashes}
                        className="px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-slate-700/70 hover:bg-blue-600 text-slate-200 hover:text-white border border-white/5 shadow-md"
                        title={lang === 'tr' ? 'Sağ ve sol kanatların yerini ve açılım yönünü tersine çevirir (Aynalar)' : 'Swap left and right sashes (Mirror)'}
                      >
                        <ArrowLeftRight size={12} className="text-blue-400" />
                        {lang === 'tr' ? 'Kanatları Değiştir (Sağ ⇄ Sol)' : 'Swap Sashes'}
                      </button>
                    )}
                  </div>

                  {previewType === 'svg' ? (
                    <div className="relative p-12 flex items-center justify-center group transition-all duration-300" style={{ transform: `scale(${visualScale * 5})`, transformOrigin: 'center center' }}>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 bg-white px-4 py-1.5 rounded-full text-[10px] font-mono text-slate-800 shadow-md flex items-center gap-2 font-black border border-slate-200 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Box size={10} className="text-blue-500" /> {width} mm
                      </div>
                      <div className="absolute left-0 top-1/2 -translate-x-16 -translate-y-1/2 rotate-90 bg-white px-4 py-1.5 rounded-full text-[10px] font-mono text-slate-800 shadow-md flex items-center gap-2 font-black border border-slate-200 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Box size={10} className="text-blue-500" /> {height} mm
                      </div>

                      <svg 
                        width={width * 0.2} 
                        height={height * 0.2} 
                        viewBox={`0 0 ${width} ${height}`} 
                        className="drop-shadow-2xl overflow-visible transition-transform duration-300"
                      >
                          <Visualizer 
                              node={rootNode} width={width} height={height} 
                              system={selectedSystem}
                              selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId}
                              shape={shape} archHeight={archHeight}
                              theme={theme}
                              hasThreshold={hasThreshold}
                              lang={lang}
                              viewPerspective={viewPerspective}
                          />
                      </svg>
                    </div>
                  ) : (
                    <div className="relative w-full h-full max-w-[550px] max-h-[500px] aspect-square flex items-center justify-center p-4">
                      <canvas 
                        ref={canvasRef} 
                        className="w-full h-full drop-shadow-2xl rounded-2xl bg-slate-950/40 border border-white/5 transition-all duration-300" 
                      />
                    </div>
                  )}
               </div>
             ) : (
               <ThreeDPreview 
                  unit={currentUnitFor3D} 
                  system={selectedSystem} 
                  scale={visualScale}
               />
             )}
        </div>
      </div>

      {showSection && (
        <CrossSection 
          system={selectedSystem} 
          glassThickness={24} 
          isOpenable={hasOpeningPart(rootNode)} 
          lang={lang} 
          onClose={() => setShowSection(false)} 
        />
      )}

      {accessoryImageModal.isOpen && accessoryImageModal.accessory && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200" onClick={() => setAccessoryImageModal({ isOpen: false, accessory: null })}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-6" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setAccessoryImageModal({ isOpen: false, accessory: null })}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all"
            >
              <X size={18} />
            </button>
            
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                {lang === 'tr' ? 'AKSESUAR RESMİ' : 'ACCESSORY IMAGE'}
              </span>
              <h3 className="text-lg font-extrabold text-white leading-snug">
                {accessoryImageModal.accessory.name}
              </h3>
            </div>

            <div className="aspect-video bg-slate-950 rounded-2xl border border-white/5 flex flex-col items-center justify-center overflow-hidden relative group">
              {customAccessoryImages[accessoryImageModal.accessory.id] ? (
                <>
                  <img
                    src={customAccessoryImages[accessoryImageModal.accessory.id]}
                    alt={accessoryImageModal.accessory.name}
                    className="w-full h-full object-contain p-4"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const fileInput = document.getElementById('modal-accessory-file') as HTMLInputElement;
                        fileInput?.click();
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
                    >
                      <Upload size={14} />
                      {lang === 'tr' ? 'Değiştir' : 'Change'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAccessoryImageCleared(accessoryImageModal.accessory!.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      {lang === 'tr' ? 'Kaldır' : 'Remove'}
                    </button>
                  </div>
                </>
              ) : (
                <div
                  onClick={() => {
                    const fileInput = document.getElementById('modal-accessory-file') as HTMLInputElement;
                    fileInput?.click();
                  }}
                  className="w-full h-full border-2 border-dashed border-white/5 hover:border-blue-500/50 rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all hover:bg-blue-500/5 group text-slate-500"
                >
                  <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-blue-500/10 text-slate-400 group-hover:text-blue-400 transition-all mb-3">
                    <Camera size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-300 mb-1">
                    {lang === 'tr' ? 'Resim Seçin' : 'Select Image'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {lang === 'tr' ? 'Sürükleyin veya tıklayarak yükleyin' : 'Drag & drop or click to upload'}
                  </p>
                </div>
              )}
              
              <input
                id="modal-accessory-file"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && accessoryImageModal.accessory) {
                    try {
                      const res = await compressImageIfNeeded(file);
                      handleAccessoryImageUploaded(accessoryImageModal.accessory.id, res.base64);
                    } catch (err) {
                      console.error('Error compressing uploaded accessory image:', err);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                          handleAccessoryImageUploaded(accessoryImageModal.accessory!.id, reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }
                }}
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setAccessoryImageModal({ isOpen: false, accessory: null })}
                className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl transition-all text-sm"
              >
                {lang === 'tr' ? 'Kapat' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
