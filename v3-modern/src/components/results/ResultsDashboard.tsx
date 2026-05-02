'use client';

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';
import { rd } from '@/lib/routing/RouteEngine';

interface DashboardProps {
  drivers: any[];
  zoneResults: Record<string, any>;
}

export const ResultsDashboard = ({ drivers, zoneResults }: DashboardProps) => {
  // 1. Data for Stops per Zone
  const zoneData = Object.entries(zoneResults).map(([name, res]) => ({
    name,
    paradas: res.ordered.length,
    km: rd(res.totalKmReal || (res.totalKm + res.returnKm), 1)
  }));

  // 2. Data for Drivers KM
  const driverData = drivers.map(d => ({
    name: d.name,
    km: rd(d.totalKm, 1),
    paradas: d.totalClients
  }));

  // 3. Efficiency Data (Total optimized vs unoptimized)
  let totOpt = 0;
  let totUnopt = 0;
  Object.values(zoneResults).forEach(r => {
    totOpt += r.totalKmReal || (r.totalKm + r.returnKm);
    totUnopt += r.unoptimizedKm;
  });

  const efficiencyData = [
    { name: 'Sin Optimizar', km: rd(totUnopt, 1), fill: '#64748b' },
    { name: 'Optimizado', km: rd(totOpt, 1), fill: '#6366f1' },
  ];

  const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];

  return (
    <div className="grid grid-cols-1 gap-6 overflow-y-auto pb-8 md:grid-cols-2">
      
      {/* Chart 1: Paradas por Zona */}
      <div className="card-premium h-[350px]">
        <h3 className="mb-4 text-sm font-bold text-white uppercase tracking-wider">📦 Paradas por Zona</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={zoneData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3449" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: '#111827', border: '1px solid #2a3449', borderRadius: '8px' }}
              itemStyle={{ color: '#fff', fontSize: '12px' }}
            />
            <Bar dataKey="paradas" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: KM por Repartidor */}
      <div className="card-premium h-[350px]">
        <h3 className="mb-4 text-sm font-bold text-white uppercase tracking-wider">🛣️ KM por Repartidor</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={driverData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3449" horizontal={false} />
            <XAxis type="number" stroke="#94a3b8" fontSize={10} hide />
            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: '#111827', border: '1px solid #2a3449', borderRadius: '8px' }}
              itemStyle={{ color: '#fff', fontSize: '12px' }}
            />
            <Bar dataKey="km" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Eficiencia */}
      <div className="card-premium h-[350px]">
        <h3 className="mb-4 text-sm font-bold text-white uppercase tracking-wider">📉 Comparativa de Eficiencia (KM)</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={efficiencyData}>
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip 
              contentStyle={{ background: '#111827', border: '1px solid #2a3449', borderRadius: '8px' }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#fff' }}
            />
            <Bar dataKey="km" radius={[8, 8, 0, 0]} barSize={60}>
              {efficiencyData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Distribución de Zonas */}
      <div className="card-premium h-[350px]">
        <h3 className="mb-4 text-sm font-bold text-white uppercase tracking-wider">🍕 Distribución de Carga</h3>
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie
              data={zoneData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="paradas"
            >
              {zoneData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ background: '#111827', border: '1px solid #2a3449', borderRadius: '8px' }}
              itemStyle={{ color: '#fff', fontSize: '12px' }}
            />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};
