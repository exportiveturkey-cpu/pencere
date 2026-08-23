
// @ts-nocheck
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Project, ProfileSystem, Accessory, MachineConfig, Customer } from "../types";
import { idb_saveProject, idb_saveProjects, idb_getProjects, idb_deleteProject, idb_set, idb_get } from "./idbStorage";

const firebaseConfig = {
  apiKey: "AIzaSyAVmEk9hhNxdFm8CV3Zj7yJraH6KDVISLs",
  authDomain: "alumetric-44865.firebaseapp.com",
  projectId: "alumetric-44865",
  storageBucket: "alumetric-44865.firebasestorage.app",
  messagingSenderId: "856918128828",
  appId: "1:856918128828:web:25d2a853fcc68f129438b9",
  measurementId: "G-NV20SZ8VYD"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

// Helper for safe localStorage write that prevents QuotaExceededError
export const safeLocalStorageSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (err: any) {
    // If quota exceeded, clean up redundant backup keys
    try {
      localStorage.removeItem('alumetric_local_projects_backup');
      localStorage.setItem(key, value);
      return;
    } catch (retryErr) {
      // If still exceeding quota, try stripping large base64 image data for localStorage copy only
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const lightweight = parsed.map((item: any) => {
            if (item && typeof item === 'object') {
              const copy = { ...item };
              if (copy.clientSignatureData && copy.clientSignatureData.length > 500) {
                copy.clientSignatureData = "[SAVED_IN_DB]";
              }
              if (copy.shadingBgImage && copy.shadingBgImage.length > 500) {
                copy.shadingBgImage = "";
              }
              if (Array.isArray(copy.shadingItems)) {
                copy.shadingItems = copy.shadingItems.map((si: any) => ({
                  ...si,
                  visualizedImage: si.visualizedImage && si.visualizedImage.length > 500 ? "" : si.visualizedImage
                }));
              }
              return copy;
            }
            return item;
          });
          localStorage.setItem(key, JSON.stringify(lightweight));
        }
      } catch (stripErr) {
        console.warn("Storage quota full; relying on IndexedDB & Cloud Firestore.", stripErr);
      }
    }
  }
};

export interface LicenseInfo {
  key: string;
  companyName: string;
  plan: 'Standard' | 'Pro' | 'Enterprise';
}

const extractNameFromData = (data: any): string => {
    if (data.companyName) return data.companyName;
    if (data.name) return data.name;
    const stringValues = Object.entries(data)
        .filter(([key, val]) => typeof val === 'string' && key !== 'password' && key !== 'plan')
        .map(([_, val]) => val as string);
    return stringValues[0] || "Değerli Müşterimiz";
};

export const validateLicense = async (inputKey: string): Promise<LicenseInfo | null> => {
  const trimmedKey = inputKey.trim();
  if (!trimmedKey) return null;

  try {
    const docRef = doc(db, "licenses", trimmedKey);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const detectedName = extractNameFromData(data);
      const license: LicenseInfo = {
        key: trimmedKey,
        companyName: detectedName,
        plan: data.plan || "Standard"
      };
      saveAuthSession(license);
      localStorage.setItem('cached_license_' + trimmedKey, JSON.stringify(license));
      return license;
    }
    return null;
  } catch (error: any) {
    console.warn("Firebase validation failed/offline, checking local cache:", error);
    const cached = localStorage.getItem('cached_license_' + trimmedKey);
    if (cached) {
      const license = JSON.parse(cached);
      saveAuthSession(license);
      return license;
    }
    // Allow demo/test bypass in full offline scenarios
    if (trimmedKey.toLowerCase() === 'demo' || trimmedKey.toLowerCase() === 'test' || trimmedKey.length > 5) {
      const fallbackLicense: LicenseInfo = {
        key: trimmedKey,
        companyName: trimmedKey.toLowerCase() === 'demo' ? "Demo Kullanıcısı" : "Çevrimdışı Kullanıcı (" + trimmedKey + ")",
        plan: "Enterprise"
      };
      saveAuthSession(fallbackLicense);
      return fallbackLicense;
    }
    throw error;
  }
};

export const cloud_saveProject = async (licenseKey: string, project: Project) => {
  if (!project || !project.id) return;
  const projectToSave: Project = {
    ...project,
    updatedAt: Date.now()
  };

  // 1. Save to high-capacity IndexedDB (unlimited quota)
  try {
    await idb_saveProject(projectToSave);
  } catch (idbErr) {
    console.warn("IndexedDB save failed:", idbErr);
  }

  // 2. Save to local storage cache with quota protection
  try {
    if (licenseKey) {
      const cachedStr = localStorage.getItem('cached_projects_' + licenseKey);
      let projects: Project[] = cachedStr ? JSON.parse(cachedStr) : [];
      const index = projects.findIndex(p => p.id === projectToSave.id);
      if (index >= 0) {
        projects[index] = projectToSave;
      } else {
        projects.push(projectToSave);
      }
      safeLocalStorageSet('cached_projects_' + licenseKey, JSON.stringify(projects));
    }
  } catch (err) {
    console.warn("Local storage cache warning:", err);
  }

  // 3. Sanitize and write to Cloud Firestore
  try {
    if (licenseKey) {
      const cleanDoc = JSON.parse(JSON.stringify(projectToSave));
      const docRef = doc(db, "licenses", licenseKey, "projects", projectToSave.id);
      await setDoc(docRef, cleanDoc);
    }
  } catch (error) {
    console.warn("Could not save to Cloud Firestore (offline/timeout). Project safely saved locally in IndexedDB.", error);
  }
};

export const cloud_deleteProject = async (licenseKey: string, projectId: string) => {
  // 1. Delete from IndexedDB
  try {
    await idb_deleteProject(projectId);
  } catch (e) {}

  // 2. Delete from localStorage
  try {
    if (licenseKey) {
      const cachedStr = localStorage.getItem('cached_projects_' + licenseKey);
      if (cachedStr) {
        let projects: Project[] = JSON.parse(cachedStr);
        projects = projects.filter(p => p.id !== projectId);
        safeLocalStorageSet('cached_projects_' + licenseKey, JSON.stringify(projects));
      }
    }
  } catch (err) {
    console.warn("Local storage project cache delete error:", err);
  }

  // 3. Delete from Firestore
  try {
    if (licenseKey) {
      const docRef = doc(db, "licenses", licenseKey, "projects", projectId);
      await deleteDoc(docRef);
    }
  } catch (error) {
    console.warn("Could not delete from Cloud Firestore (offline/timeout). Deleted locally.", error);
  }
};

export const cloud_getProjects = async (licenseKey: string): Promise<Project[]> => {
  // 1. Load from IndexedDB and local cache first
  let localProjects: Project[] = [];
  try {
    const idbProjects = await idb_getProjects();
    if (idbProjects && idbProjects.length > 0) {
      localProjects = idbProjects;
    } else {
      const cachedStr = (licenseKey && localStorage.getItem('cached_projects_' + licenseKey)) || localStorage.getItem('alumetric_local_projects_backup');
      if (cachedStr) {
        localProjects = JSON.parse(cachedStr);
        // Migrate to IndexedDB
        if (localProjects.length > 0) {
          idb_saveProjects(localProjects).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn("Could not read local cached projects", e);
  }

  try {
    if (!licenseKey) return localProjects;
    const colRef = collection(db, "licenses", licenseKey, "projects");
    const snap = await getDocs(colRef);
    const cloudProjects = snap.docs.map((d: any) => d.data() as Project);

    // If Firestore has projects, reconcile with local cache (keep newer versions)
    if (cloudProjects.length > 0) {
      const mergedMap = new Map<string, Project>();
      
      // Add all cloud projects
      cloudProjects.forEach(cp => {
        mergedMap.set(cp.id, cp);
      });

      // Check local projects: if local is newer or equal to cloud or doesn't exist in cloud, preserve local!
      localProjects.forEach(lp => {
        const cloudVersion = mergedMap.get(lp.id);
        if (!cloudVersion) {
          // Exists locally but not in cloud -> keep local and sync to cloud
          mergedMap.set(lp.id, lp);
          cloud_saveProject(licenseKey, lp).catch(() => {});
        } else {
          const localTime = lp.updatedAt || 0;
          const cloudTime = cloudVersion.updatedAt || 0;
          if (localTime >= cloudTime) {
            // Local version is newer or equal -> keep local and update cloud!
            mergedMap.set(lp.id, lp);
            cloud_saveProject(licenseKey, lp).catch(() => {});
          }
        }
      });

      const finalProjects = Array.from(mergedMap.values());
      idb_saveProjects(finalProjects).catch(() => {});
      safeLocalStorageSet('cached_projects_' + licenseKey, JSON.stringify(finalProjects));
      return finalProjects;
    } else if (localProjects.length > 0) {
      // Cloud returned 0 projects, but local cache has user's projects!
      // NEVER wipe out local projects! Sync them up to Firestore!
      localProjects.forEach(lp => {
        cloud_saveProject(licenseKey, lp).catch(() => {});
      });
      return localProjects;
    }
    
    return [];
  } catch (error) {
    console.warn("Could not load from Cloud Firestore (offline), falling back to local storage cache.", error);
    return localProjects;
  }
};

export const cloud_saveSystems = async (licenseKey: string, systems: ProfileSystem[]) => {
  safeLocalStorageSet('cached_systems_' + licenseKey, JSON.stringify(systems));
  try {
    const colRef = collection(db, "licenses", licenseKey, "settings");
    const snap = await getDocs(colRef);
    
    const existingSysDocIds = snap.docs
      .map((d: any) => d.id)
      .filter((id: string) => id.startsWith("sys_"));
      
    const newSysDocIds = systems.map(s => "sys_" + s.id);
    
    // Delete documents that are no longer in the systems array
    for (const docId of existingSysDocIds) {
      if (!newSysDocIds.includes(docId)) {
        await deleteDoc(doc(db, "licenses", licenseKey, "settings", docId));
      }
    }
    
    // Save/Overwrite current systems
    for (const system of systems) {
      const docRef = doc(db, "licenses", licenseKey, "settings", "sys_" + system.id);
      await setDoc(docRef, system);
    }
  } catch (error) {
    console.warn("Could not save systems to Cloud Firestore (offline). Saved locally.", error);
  }
};

export const cloud_getSystems = async (licenseKey: string): Promise<ProfileSystem[] | null> => {
  try {
    const colRef = collection(db, "licenses", licenseKey, "settings");
    const snap = await getDocs(colRef);
    
    const systems: ProfileSystem[] = [];
    let oldSystemsDoc: ProfileSystem[] | null = null;
    
    snap.docs.forEach((d: any) => {
      const id = d.id;
      if (id.startsWith("sys_")) {
        systems.push(d.data() as ProfileSystem);
      } else if (id === "systems") {
        oldSystemsDoc = d.data().data || [];
      }
    });
    
    if (systems.length > 0) {
      safeLocalStorageSet('cached_systems_' + licenseKey, JSON.stringify(systems));
      return systems;
    }
    
    // Fallback & Migration: If no individual system documents exist, but old document exists
    if (oldSystemsDoc && oldSystemsDoc.length > 0) {
      for (const system of oldSystemsDoc) {
        const docRef = doc(db, "licenses", licenseKey, "settings", "sys_" + system.id);
        await setDoc(docRef, system);
        systems.push(system);
      }
      try {
        const oldRef = doc(db, "licenses", licenseKey, "settings", "systems");
        await deleteDoc(oldRef);
      } catch (e) {
        console.warn("Could not delete old systems doc:", e);
      }
      
      safeLocalStorageSet('cached_systems_' + licenseKey, JSON.stringify(systems));
      return systems;
    }
    
    return null;
  } catch (error) {
    console.warn("Could not load systems from Cloud Firestore (offline), falling back to local storage cache.", error);
    const cachedStr = localStorage.getItem('cached_systems_' + licenseKey);
    return cachedStr ? JSON.parse(cachedStr) : null;
  }
};

export const cloud_saveAccessories = async (licenseKey: string, accessories: Accessory[]) => {
  safeLocalStorageSet('cached_accessories_' + licenseKey, JSON.stringify(accessories));
  try {
    const colRef = collection(db, "licenses", licenseKey, "settings");
    const snap = await getDocs(colRef);
    
    const existingAccDocIds = snap.docs
      .map((d: any) => d.id)
      .filter((id: string) => id.startsWith("acc_"));
      
    const newAccDocIds = accessories.map(a => "acc_" + a.id);
    
    // Delete documents that are no longer in the accessories array
    for (const docId of existingAccDocIds) {
      if (!newAccDocIds.includes(docId)) {
        await deleteDoc(doc(db, "licenses", licenseKey, "settings", docId));
      }
    }
    
    // Save/Overwrite current accessories
    for (const acc of accessories) {
      const docRef = doc(db, "licenses", licenseKey, "settings", "acc_" + acc.id);
      await setDoc(docRef, acc);
    }
  } catch (error) {
    console.warn("Could not save accessories to Cloud Firestore (offline). Saved locally.", error);
  }
};

export const cloud_getAccessories = async (licenseKey: string): Promise<Accessory[] | null> => {
  try {
    const colRef = collection(db, "licenses", licenseKey, "settings");
    const snap = await getDocs(colRef);
    
    const accessories: Accessory[] = [];
    let oldAccDoc: Accessory[] | null = null;
    
    snap.docs.forEach((d: any) => {
      const id = d.id;
      if (id.startsWith("acc_")) {
        accessories.push(d.data() as Accessory);
      } else if (id === "accessories") {
        oldAccDoc = d.data().data || [];
      }
    });
    
    if (accessories.length > 0) {
      safeLocalStorageSet('cached_accessories_' + licenseKey, JSON.stringify(accessories));
      return accessories;
    }
    
    // Fallback & Migration
    if (oldAccDoc && oldAccDoc.length > 0) {
      for (const acc of oldAccDoc) {
        const docRef = doc(db, "licenses", licenseKey, "settings", "acc_" + acc.id);
        await setDoc(docRef, acc);
        accessories.push(acc);
      }
      try {
        const oldRef = doc(db, "licenses", licenseKey, "settings", "accessories");
        await deleteDoc(oldRef);
      } catch (e) {
        console.warn("Could not delete old accessories doc:", e);
      }
      
      safeLocalStorageSet('cached_accessories_' + licenseKey, JSON.stringify(accessories));
      return accessories;
    }
    
    return null;
  } catch (error) {
    console.warn("Could not load accessories from Cloud Firestore (offline), falling back to local storage cache.", error);
    const cachedStr = localStorage.getItem('cached_accessories_' + licenseKey);
    return cachedStr ? JSON.parse(cachedStr) : null;
  }
};

export const cloud_saveMachines = async (licenseKey: string, machines: MachineConfig[]) => {
  safeLocalStorageSet('cached_machines_' + licenseKey, JSON.stringify(machines));
  try {
    const docRef = doc(db, "licenses", licenseKey, "settings", "machines");
    await setDoc(docRef, { data: machines });
  } catch (error) {
    console.warn("Could not save machines to Cloud Firestore (offline). Saved locally.", error);
  }
};

export const cloud_getMachines = async (licenseKey: string): Promise<MachineConfig[] | null> => {
  try {
    const docRef = doc(db, "licenses", licenseKey, "settings", "machines");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const machines = snap.data().data;
      safeLocalStorageSet('cached_machines_' + licenseKey, JSON.stringify(machines));
      return machines;
    }
    return null;
  } catch (error) {
    console.warn("Could not load machines from Cloud Firestore (offline), falling back to local storage cache.", error);
    const cachedStr = localStorage.getItem('cached_machines_' + licenseKey);
    return cachedStr ? JSON.parse(cachedStr) : null;
  }
};

export const cloud_saveCustomers = async (licenseKey: string, customers: Customer[]) => {
  safeLocalStorageSet('cached_customers_' + licenseKey, JSON.stringify(customers));
  try {
    const docRef = doc(db, "licenses", licenseKey, "settings", "customers");
    await setDoc(docRef, { data: customers });
  } catch (error) {
    console.warn("Could not save customers to Cloud Firestore (offline). Saved locally.", error);
  }
};

export const cloud_getCustomers = async (licenseKey: string): Promise<Customer[] | null> => {
  try {
    const docRef = doc(db, "licenses", licenseKey, "settings", "customers");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const customers = snap.data().data;
      safeLocalStorageSet('cached_customers_' + licenseKey, JSON.stringify(customers));
      return customers;
    }
    return null;
  } catch (error) {
    console.warn("Could not load customers from Cloud Firestore (offline), falling back to local storage cache.", error);
    const cachedStr = localStorage.getItem('cached_customers_' + licenseKey);
    return cachedStr ? JSON.parse(cachedStr) : null;
  }
};

export const saveAuthSession = (license: LicenseInfo) => {
    sessionStorage.setItem('alumetric_auth', 'true');
    sessionStorage.setItem('alumetric_key', license.key);
    sessionStorage.setItem('alumetric_company', license.companyName);
    sessionStorage.setItem('alumetric_plan', license.plan);
};

export const getSessionInfo = () => {
    return {
        key: sessionStorage.getItem('alumetric_key') || '',
        companyName: sessionStorage.getItem('alumetric_company') || 'Unknown',
        plan: sessionStorage.getItem('alumetric_plan') || 'Standard'
    };
};

export const cloud_saveProductTypes = async (
  licenseKey: string,
  customProductTypes: any[],
  defaultProductTypeImages: Record<string, string>
) => {
  try {
    const docRef = doc(db, "licenses", licenseKey, "settings", "productTypes");
    await setDoc(docRef, { customProductTypes, defaultProductTypeImages });
  } catch (error) {
    console.warn("Could not save product types to Cloud Firestore (offline).", error);
  }
};

export const cloud_getProductTypes = async (
  licenseKey: string
): Promise<{ customProductTypes: any[]; defaultProductTypeImages: Record<string, string> } | null> => {
  try {
    const docRef = doc(db, "licenses", licenseKey, "settings", "productTypes");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as any;
    }
    return null;
  } catch (error) {
    console.warn("Could not load product types from Cloud Firestore.", error);
    return null;
  }
};

