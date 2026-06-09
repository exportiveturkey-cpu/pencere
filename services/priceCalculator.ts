import { Project, Unit, ProfileSystem, Accessory } from '../types';
import { GLASS_TYPES } from '../constants';
import { getAggregatedCuttingList } from './optimizationService';

export interface ProjectCostReport {
  subTotal: number;
  discountAmount: number;
  discountedSubTotal: number;
  vatAmount: number;
  grandTotal: number;
}

export const calculateProjectCost = (
  project: Project,
  systems: ProfileSystem[],
  accessories: Accessory[]
): ProjectCostReport => {
  const taxRate = Number(localStorage.getItem('alucraft_tax')) || 20;
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
    
    let perimeterM = 0;
    systemCuts.forEach(cut => {
      const lengthM = cut.length / 1000;
      perimeterM += lengthM * cut.quantity;
    });

    const glassObj = GLASS_TYPES.find(g => g.id === unit.glassType);
    const totalAreaM2 = (unit.width * unit.height) / 1000000;
    const profileCost = perimeterM * (system.pricePerMeter || 85);
    
    let glassCost = 0;
    if (unit.includeGlass !== false) {
      const gPrice = unit.customGlassPrice !== undefined ? unit.customGlassPrice : (glassObj?.pricePerSqm || 65);
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
        accCost += acc.price * qty;
      }
    });

    const unitCost = profileCost + glassCost + accCost;
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
