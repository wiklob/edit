import { Outlet } from 'react-router-dom';
import { BreadcrumbProvider, SidebarProvider, useBreadcrumbs } from '../../lib';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import styles from './Layout.module.css';

function MainContent() {
  const { breadcrumbs } = useBreadcrumbs();

  return (
    <main className={styles.main}>
      {breadcrumbs.length > 0 && <Header breadcrumbs={breadcrumbs} />}
      <div className={styles.content}>
        <Outlet />
      </div>
    </main>
  );
}

export function Layout() {
  return (
    <SidebarProvider>
      <BreadcrumbProvider>
        <div className={styles.layout}>
          <Sidebar />
          <MainContent />
        </div>
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
