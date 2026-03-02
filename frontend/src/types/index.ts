export interface Metadata {
  id: string;
  structData: {
    title: string;
    description: string;
    date_valeur: string;
  };
  content: {
    mimeType: string;
    uri: string;
  };
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: string;
  contentType: string;
  updated: string;
  metadata: Metadata | null;
}

export interface FolderNode {
  id: string; // The full path acting as ID, e.g., "RH/Contrats/"
  name: string; // The last part, e.g., "Contrats"
  path: string;
  children?: FolderNode[];
}
