import { Project, Unit, ProfileSystem, Accessory, WindowNode } from '../types';
import { GLASS_TYPES } from '../constants';
import { getAggregatedCuttingList } from './optimizationService';

export interface UnitSashLaborCounts {
  tiltTurnCount: number;
  slidingCount: number;
  totalSashCount: number;
}

export const getUnitSashLaborCounts = (unit: Unit, system?: ProfileSystem): UnitSashLaborCounts => {
  let tiltTurnCount = 0;
  let slidingCount = 0;
  let totalSashCount = 0;

  const traverse = (node?: WindowNode) => {
    if (!node) return;
    if (node.type === 'void') return;
    const isSash = node.type === 'sash' || (node.openingType && node.openingType !== 'fixed');
    if (isSash) {
      totalSashCount += 1;
      const op = (node.openingType || '').toLowerCase();
      if (op === 'tilt-turn-left' || op === 'tilt-turn-right' || op.includes('tilt-turn') || op.includes('tilt_turn') || op.includes('çift açılım') || op.includes('cift acilim')) {
        tiltTurnCount += 1;
      } else if (op === 'sliding' || op.includes('surme') || op.includes('sürme')) {
        slidingCount += 1;
      }
    }
    if (node.children && node.children.length > 0) {
      node.children.forEach(traverse);
    }
  };

  traverse(unit.rootNode);

  // If system is a sliding type (or 50LS / 51LS) and slidingCount is 0 but unit has openable/sash nodes, treat sashes as sliding leafs
  const sysName = ((system?.name || unit.system || '')).toLowerCase();
  const isSlidingSys = (system?.type === 'sliding') || sysName.includes('50ls') || sysName.includes('51ls') || sysName.includes('sürme') || sysName.includes('sliding');
  if (isSlidingSys && slidingCount === 0 && totalSashCount > 0) {
    slidingCount = totalSashCount;
  }

  return { tiltTurnCount, slidingCount, totalSashCount };
};

export interface ProjectCostReport {
  subTotal: number;
  discountAmount: number;
  discountedSubTotal: number;
  vatAmount: number;
  grandTotal: number;
}

export const getActiveCurrency = (): string => {
  if (typeof window === 'undefined') return 'USD';
  return localStorage.getItem('alucraft_currency') || 'USD';
};

export const getCurrencySymbol = (paramCurrency?: string): string => {
  const currency = paramCurrency || getActiveCurrency();
  switch (currency) {
    case 'TRY': return '₺';
    case 'USD':
    default:
      return '$';
  }
};

export const getExchangeRate = (currency?: string): number => {
  const curr = currency || getActiveCurrency();
  if (curr === 'TRY') return 1.0;
  
  if (typeof window === 'undefined') return 1.0;
  const usdRate = parseFloat(localStorage.getItem('alucraft_usd_rate') || '33.0') || 33.0;
  return usdRate;
};

export const getConvertedAccessoryPrice = (rawPrice: number, targetCurrency: string): number => {
  if (targetCurrency === 'USD') return rawPrice;
  if (typeof window === 'undefined') return rawPrice;
  const usdRate = parseFloat(localStorage.getItem('alucraft_usd_rate') || '33.0') || 33.0;
  
  if (targetCurrency === 'TRY') {
    return rawPrice * usdRate;
  }
  return rawPrice;
};

export const getColorPricePerKg = (colorKey: string | undefined, currency?: string): number => {
  const activeCurr = currency || getActiveCurrency();
  const isUsd = activeCurr === 'USD';
  const storageKey = isUsd ? 'alucraft_color_prices_usd' : 'alucraft_color_prices';
  
  if (typeof window === 'undefined') {
    const defaultTry = 185;
    return isUsd ? parseFloat((defaultTry / 33.0).toFixed(2)) : defaultTry;
  }
  
  const saved = localStorage.getItem(storageKey);
  let prices: Record<string, number> = {};
  if (saved) {
    try {
      prices = JSON.parse(saved);
    } catch (e) {
      console.error("Could not parse color prices:", e);
    }
  }
  
  const key = colorKey ? colorKey.toLowerCase().trim() : '';
  
  const getFallback = (keyType: string, defaultTry: number): number => {
    if (prices[keyType] !== undefined) return prices[keyType];
    return isUsd ? parseFloat((defaultTry / 33.0).toFixed(2)) : defaultTry;
  };

  if (key === 'pres') return getFallback('pres', 160);
  if (key === 'group1' || key.includes('grup 1') || key.includes('9016') || key.includes('9010') || key.includes('8014') || key.includes('7016') || key.includes('9005')) {
    return getFallback('group1', 185);
  }
  if (key === 'group2' || key.includes('grup 2') || key.includes('9001') || key.includes('7031') || key.includes('5002') || key.includes('7040') || key.includes('9003') || key.includes('7039') || key.includes('1013') || key.includes('1015') || key.includes('5005') || key.includes('7035') || key.includes('7042') || key.includes('8016') || key.includes('3020') || key.includes('9006') || key.includes('9002') || key.includes('texture')) {
    return getFallback('group2', 205);
  }
  if (key === 'mat_eloxal' || key.includes('mat eloksal')) return getFallback('mat_eloxal', 195);
  if (key === 'parlak_eloxal' || key.includes('parlak eloksal')) return getFallback('parlak_eloxal', 215);
  if (key === 'mat_siyah_eloxal' || key.includes('mat siyah')) return getFallback('mat_siyah_eloxal', 210);
  if (key === 'parlak_siyah_eloxal' || key.includes('parlak siyah')) return getFallback('parlak_siyah_eloxal', 225);
  if (key === 'wood_transfer' || key.includes('ahşap') || key.includes('wood')) return getFallback('wood_transfer', 250);
  
  if (prices[colorKey || ''] !== undefined) return prices[colorKey || ''];
  return getFallback('group1', 185);
};

export const calculateProjectCost = (
  project: Project,
  systems: ProfileSystem[],
  accessories: Accessory[]
): ProjectCostReport => {
  const taxRate = Number(localStorage.getItem('alucraft_tax')) || 20;
  const currency = getActiveCurrency();
  const exchangeRate = getExchangeRate(currency);
  let subTotal = 0;

  project.units.forEach((unit) => {
    let system = systems.find(s => s.id === unit.system);
    if (!system) {
      system = systems.find(s => s.name.toLowerCase().includes(unit.system.toLowerCase()));
    }
    if (!system) {
      system = systems[0];
    }
    
    if (!system) return;

    const cuttingListMap = getAggregatedCuttingList([unit], [system]);
    const systemCuts = cuttingListMap[system.name] || [];
    
    let profileWeight = 0;
    let perimeterM = 0;
    systemCuts.forEach(cut => {
      const lengthM = cut.length / 1000;
      perimeterM += lengthM * cut.quantity;
      const label = cut.label.toLowerCase();
      
      const weightPerMeter = 
        label.includes('frame') || label.includes('kasa') ? (system?.profileWeights?.frame || 0) :
        label.includes('sash') || label.includes('kanat') ? (system?.profileWeights?.sash || 0) :
        label.includes('mullion') || label.includes('transom') || label.includes('kayıt') ? (system?.profileWeights?.mullion || 0) :
        label.includes('bead') || label.includes('çıta') ? (system?.profileWeights?.glazingBead || 0) : 0;
        
      profileWeight += lengthM * weightPerMeter * cut.quantity;
    });

    const glassObj = GLASS_TYPES.find(g => g.id === unit.glassType);
    const totalAreaM2 = (unit.width * unit.height) / 1000000;
    
    let colorPrice = getColorPricePerKg(unit.color, currency);
    
    const laborPerKgTry = system?.laborPricePerKg || 0;
    const laborPerKgUsd = system?.laborPricePerKgUsd || 0;
    let systemLaborRate = 0;
    if (currency === 'TRY') {
      systemLaborRate = laborPerKgTry || (laborPerKgUsd * exchangeRate);
    } else {
      systemLaborRate = laborPerKgUsd || (laborPerKgTry / exchangeRate);
    }

    let profileCost = 0;
    if (system?.materialType === 'pvc') {
      const convertedPricePerMeter = currency === 'TRY' ? (system.pricePerMeter || 85) : ((system.pricePerMeter || 85) / exchangeRate);
      profileCost = (perimeterM * 1.10) * convertedPricePerMeter;
    } else {
      profileCost = (profileWeight * 1.10) * (colorPrice + systemLaborRate); // 10% wastage increase for costing included with labor per kg
    }
    
    let glassCost = 0;
    if (unit.includeGlass !== false) {
      let gPrice = unit.customGlassPrice !== undefined ? unit.customGlassPrice : (glassObj?.pricePerSqm || 65);
      if (currency !== 'TRY') {
        gPrice = gPrice / exchangeRate;
      }
      glassCost = totalAreaM2 * gPrice;
    }
    
    let accCost = 0;
    const accIds = [
      unit.selectedHandle, 
      unit.selectedGasket, 
      unit.selectedHinge, 
      unit.selectedCorner, 
      unit.selectedLock, 
      unit.selectedAutomation,
      unit.selectedLockStriker,
      unit.selectedDoorCloser,
      unit.selectedKickplate,
      unit.selectedOther
    ].filter(Boolean);

    accIds.forEach(id => {
      const acc = accessories.find(a => a.id === id);
      if (acc) {
        let qty = 1;
        if (acc.unit === 'meter') qty = perimeterM;
        const convertedPrice = getConvertedAccessoryPrice(acc.price, currency);
        accCost += convertedPrice * qty;
      }
    });

    // Calculate per-sash accessory mounting labor costs
    const sashCounts = getUnitSashLaborCounts(unit, system);
    
    // Tilt-Turn Accessory Mounting Labor (ALÜMİNYUM ÇİFT AÇILIM PENCERE KANAT AKSESUAR MONTAJ BEDELİ)
    const tiltTurnTry = system?.tiltTurnLaborPrice || 0;
    const tiltTurnUsd = system?.tiltTurnLaborPriceUsd || 0;
    let tiltTurnRate = 0;
    if (currency === 'TRY') {
      tiltTurnRate = tiltTurnTry || (tiltTurnUsd * exchangeRate);
    } else {
      tiltTurnRate = tiltTurnUsd || (tiltTurnTry / exchangeRate);
    }
    const tiltTurnLaborCost = sashCounts.tiltTurnCount * tiltTurnRate;

    // HBSB Lift-Slide Accessory Mounting Labor (ALÜMİNYUM HBSB SÜRME AKSESUAR MONTAJ BEDELİ (HER KANAT İÇİN))
    const hbsbTry = system?.hbsbLaborPrice || 0;
    const hbsbUsd = system?.hbsbLaborPriceUsd || 0;
    let hbsbRate = 0;
    if (currency === 'TRY') {
      hbsbRate = hbsbTry || (hbsbUsd * exchangeRate);
    } else {
      hbsbRate = hbsbUsd || (hbsbTry / exchangeRate);
    }
    const hbsbLaborCost = sashCounts.slidingCount * hbsbRate;

    const unitCost = profileCost + glassCost + accCost + tiltTurnLaborCost + hbsbLaborCost;
    subTotal += unitCost * (unit.quantity || 1);
  });

  const discountAmount = (subTotal * (project.discountPercentage || 0)) / 100;
  const discountedSubTotal = subTotal - discountAmount;
  const vatAmount = project.isExport ? 0 : (discountedSubTotal * taxRate) / 100;
  return {
    subTotal,
    discountAmount,
    discountedSubTotal,
    vatAmount,
    grandTotal: discountedSubTotal + vatAmount
  };
};
