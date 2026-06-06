
// @ts-nocheck
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Project, ProfileSystem, Accessory, MachineConfig } from "../types";

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
  try {
    const trimmedKey = inputKey.trim();
    if (!trimmedKey) return null;
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
      return license;
    }
    return null;
  } catch (error: any) { throw error; }
};

export const cloud_saveProject = async (licenseKey: string, project: Project) => {
  const docRef = doc(db, "licenses", licenseKey, "projects", project.id);
  await setDoc(docRef, project);
};

export const cloud_deleteProject = async (licenseKey: string, projectId: string) => {
  const docRef = doc(db, "licenses", licenseKey, "projects", projectId);
  await deleteDoc(docRef);
};

export const cloud_getProjects = async (licenseKey: string): Promise<Project[]> => {
  const colRef = collection(db, "licenses", licenseKey, "projects");
  const snap = await getDocs(colRef);
  return snap.docs.map((d: any) => d.data() as Project);
};

export const cloud_saveSystems = async (licenseKey: string, systems: ProfileSystem[]) => {
  const docRef = doc(db, "licenses", licenseKey, "settings", "systems");
  await setDoc(docRef, { data: systems });
};

export const cloud_getSystems = async (licenseKey: string): Promise<ProfileSystem[] | null> => {
  const docRef = doc(db, "licenses", licenseKey, "settings", "systems");
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data().data : null;
};

export const cloud_saveAccessories = async (licenseKey: string, accessories: Accessory[]) => {
  const docRef = doc(db, "licenses", licenseKey, "settings", "accessories");
  await setDoc(docRef, { data: accessories });
};

export const cloud_getAccessories = async (licenseKey: string): Promise<Accessory[] | null> => {
  const docRef = doc(db, "licenses", licenseKey, "settings", "accessories");
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data().data : null;
};

export const cloud_saveMachines = async (licenseKey: string, machines: MachineConfig[]) => {
  const docRef = doc(db, "licenses", licenseKey, "settings", "machines");
  await setDoc(docRef, { data: machines });
};

export const cloud_getMachines = async (licenseKey: string): Promise<MachineConfig[] | null> => {
  const docRef = doc(db, "licenses", licenseKey, "settings", "machines");
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data().data : null;
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
