import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Page, Section } from '../types';

interface SidebarContextType {
  sections: Section[];
  setSections: React.Dispatch<React.SetStateAction<Section[]>>;
  sectionPages: Record<string, Page[]>;
  setSectionPages: React.Dispatch<React.SetStateAction<Record<string, Page[]>>>;
  updatePageIcon: (pageId: string, icon: string | null) => void;
  updateSectionIcon: (sectionId: string, icon: string | null) => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionPages, setSectionPages] = useState<Record<string, Page[]>>({});

  const updatePageIcon = useCallback((pageId: string, icon: string | null) => {
    setSectionPages(prev => {
      const updated = { ...prev };
      for (const sectionId in updated) {
        updated[sectionId] = updated[sectionId].map(page =>
          page.id === pageId ? { ...page, icon } : page
        );
      }
      return updated;
    });
  }, []);

  const updateSectionIcon = useCallback((sectionId: string, icon: string | null) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId ? { ...section, icon } : section
    ));
  }, []);

  return (
    <SidebarContext.Provider value={{ sections, setSections, sectionPages, setSectionPages, updatePageIcon, updateSectionIcon }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
