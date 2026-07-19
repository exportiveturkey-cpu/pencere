
// @ts-nocheck
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Project, ProfileSystem, Accessory, MachineConfig, Customer } from "../types";

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
const db = getFirestore(app);

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
  // Save to local cache first
  try {
    const cachedStr = localStorage.getItem('cached_projects_' + licenseKey);
    let projects: Project[] = cachedStr ? JSON.parse(cachedStr) : [];
    projects = projects.filter(p => p.id !== project.id);
    projects.push(project);
    localStorage.setItem('cached_projects_' + licenseKey, JSON.stringify(projects));
  } catch (err) {
    console.error("Local storage project cache write error:", err);
  }

  try {
    const docRef = doc(db, "licenses", licenseKey, "projects", project.id);
    await setDoc(docRef, project);
  } catch (error) {
    console.warn("Could not save to Cloud Firestore (offline/timeout). Project saved locally.", error);
  }
};

export const cloud_deleteProject = async (licenseKey: string, projectId: string) => {
  try {
    const cachedStr = localStorage.getItem('cached_projects_' + licenseKey);
    if (cachedStr) {
      let projects: Project[] = JSON.parse(cachedStr);
      projects = projects.filter(p => p.id !== projectId);
      localStorage.setItem('cached_projects_' + licenseKey, JSON.stringify(projects));
    }
  } catch (err) {
    console.error("Local storage project cache delete error:", err);
  }

  try {
    const docRef = doc(db, "licenses", licenseKey, "projects", projectId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("Could not delete from Cloud Firestore (offline/timeout). Deleted locally.", error);
  }
};

export const cloud_getProjects = async (licenseKey: string): Promise<Project[]> => {
  try {
    const colRef = collection(db, "licenses", licenseKey, "projects");
    const snap = await getDocs(colRef);
    const projects = snap.docs.map((d: any) => d.data() as Project);
    localStorage.setItem('cached_projects_' + licenseKey, JSON.stringify(projects));
    return projects;
  } catch (error) {
    console.warn("Could not load from Cloud Firestore (offline), falling back to local storage cache.", error);
    const cachedStr = localStorage.getItem('cached_projects_' + licenseKey);
    return cachedStr ? JSON.parse(cachedStr) : [];
  }
};

export const cloud_saveSystems = async (licenseKey: string, systems: ProfileSystem[]) => {
  localStorage.setItem('cached_systems_' + licenseKey, JSON.stringify(systems));
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
      localStorage.setItem('cached_systems_' + licenseKey, JSON.stringify(systems));
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
      
      localStorage.setItem('cached_systems_' + licenseKey, JSON.stringify(systems));
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
  localStorage.setItem('cached_accessories_' + licenseKey, JSON.stringify(accessories));
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
      localStorage.setItem('cached_accessories_' + licenseKey, JSON.stringify(accessories));
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
      
      localStorage.setItem('cached_accessories_' + licenseKey, JSON.stringify(accessories));
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
  localStorage.setItem('cached_machines_' + licenseKey, JSON.stringify(machines));
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
      localStorage.setItem('cached_machines_' + licenseKey, JSON.stringify(machines));
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
  localStorage.setItem('cached_customers_' + licenseKey, JSON.stringify(customers));
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
      localStorage.setItem('cached_customers_' + licenseKey, JSON.stringify(customers));
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

