import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { rd } from '../routing/RouteEngine';

export function exportResultsToPdf(drivers: any[], zoneResults: Record<string, any>, stats: any) {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('es-PY');

  // --- HEADER ---
  doc.setFillColor(13, 17, 23); // Dark theme color
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('RutasPro v3.0', 14, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Reporte de Rutas Optimizadas — ${today}`, 14, 28);

  // Stats Box
  doc.setFillColor(26, 34, 53);
  doc.roundedRect(130, 10, 66, 20, 3, 3, 'F');
  doc.setFontSize(8);
  doc.text(`KM Totales: ${rd(stats.totKm, 1)} km`, 135, 17);
  doc.text(`Ahorro Est.: ${rd(stats.savedKm, 1)} km`, 135, 24);

  let currentY = 50;

  // --- DRIVER TABLES ---
  drivers.forEach((driver, index) => {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(13, 17, 23);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${driver.name}`, 14, currentY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Zonas: ${driver.zones.join(', ')} · ${driver.totalClients} paradas`, 14, currentY + 6);
    
    currentY += 12;

    const tableData: any[] = [];
    driver.zones.forEach((zoneName: string) => {
      const result = zoneResults[zoneName];
      if (!result) return;
      
      result.ordered.forEach((c: any) => {
        tableData.push([
          c.ORDER,
          c.CLIENTE,
          c.NOMBRE_CLIENTE,
          zoneName,
          c.DESCRIPCION,
          c.LEG_KM_REAL != null ? `${rd(c.LEG_KM_REAL, 1)} km *` : `${c.LEG_KM} km`
        ]);
      });
    });

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'ID', 'Cliente', 'Zona', 'Descripción', 'Distancia']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 15 },
        3: { cellWidth: 20 },
        5: { cellWidth: 22, halign: 'right' }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (_data) => {
        // Add note about OSRM on the last page
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
        const totalPages = (doc as any).internal.getNumberOfPages();
        if (currentPage === totalPages) {
             doc.setFontSize(7);
             doc.setTextColor(100);
             doc.text('* Indica distancia real por carretera (OSRM)', 14, (doc as any).internal.pageSize.height - 15);
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  });

  // --- FOOTER ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount} — Generado por RutasPro v3.0`, 105, 290, { align: 'center' });
  }

  doc.save(`RutasPro_Reporte_${new Date().toISOString().split('T')[0]}.pdf`);
}
