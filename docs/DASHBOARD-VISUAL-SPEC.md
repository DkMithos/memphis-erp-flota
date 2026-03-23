# Dashboard Enterprise - Flota | Especificación Visual

## 🎨 Layout General

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Dashboard Enterprise - Flota                    [Exportar] [+Vehículo] │
│  Monitoreo en tiempo real con métricas avanzadas                   │
├─────────────────────────────────────────────────────────────────────┤
│  ● Sistema operativo 24/7        🔄 Última actualización: 11/02/25 12:30 │
├─────────────────────────────────────────────────────────────────────┤
│  🎯 Filtros de Dashboard                           [Limpiar Filtros]│
│  ┌──────────┬──────────┬──────────┬──────────┐                      │
│  │Fecha     │Fecha     │Tipo OT   │Taller    │                      │
│  │Desde     │Hasta     │          │          │                      │
│  │[____]    │[____]    │[____]    │[____]    │                      │
│  └──────────┴──────────┴──────────┴──────────┘                      │
├─────────────────────────────────────────────────────────────────────┤
│  🏆 KPIs Enterprise                                                 │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┐                             │
│  │ 6   │83.3%│ 3.4 │8,500│$2.8K│ 75% │                             │
│  │Veh. │Disp.│MTTR │MTBF │Cost │ SLA │                             │
│  └─────┴─────┴─────┴─────┴─────┴─────┘                             │
├─────────────────────────────────────────────────────────────────────┤
│  🚛 Vehículos                                     [Ver Todos →]     │
│  ┌─────┬─────┬─────┬─────┬─────┐                                   │
│  │  6  │  5  │  1  │  0  │52K  │                                   │
│  │Total│Activ│Taller│Inact│KMprom│                                 │
│  └─────┴─────┴─────┴─────┴─────┘                                   │
├─────────────────────────────────────────────────────────────────────┤
│  🔧 Órdenes de Trabajo                            [Ver Todas →]    │
│  ┌─────┬─────┬─────┬─────┐                                         │
│  │  6  │  1  │  1  │  1  │                                         │
│  │Total│EnEje│Aprob│Cerrad│                                        │
│  └─────┴─────┴─────┴─────┘                                         │
├─────────────────────────────────────────────────────────────────────┤
│  ⚠️  Atención: 2 vehículos con mantenimiento próximo o vencido     │
├─────────────────────────────────────────────────────────────────────┤
│  ⚠️  Vehículos que Requieren Atención           [Ver Todos]        │
│  ┌────┬────┬──────┬────┬────────┬──────┬──────┐                   │
│  │Placa│Tipo│Marca │ KM │Próximo │Estado│Acción│                  │
│  ├────┼────┼──────┼────┼────────┼──────┼──────┤                   │
│  │ABC │Amb │Benz  │48K │20/12   │Vencid│[+OT] │                  │
│  │    │    │Sprin │    │(-3d)   │      │      │                  │
│  └────┴────┴──────┴────┴────────┴──────┴──────┘                   │
├─────────────────────────────────────────────────────────────────────┤
│  📈 Gráficos Analíticos                                             │
│  ┌──────────────────────┬──────────────────────┐                   │
│  │ Tendencia OTs        │ Distribución Estado  │                   │
│  │ [Line Chart]         │ [Pie Chart]          │                   │
│  │ Jul-Dic              │ Activo/Taller/Inact  │                   │
│  └──────────────────────┴──────────────────────┘                   │
├─────────────────────────────────────────────────────────────────────┤
│  🏆 Ranking de Talleres por Performance                             │
│  ┌──┬────────────┬────┬───┬────┬────┬──────┬──────┐               │
│  │# │Taller      │Tipo│OTs│SLA%│MTTR│Total │Prom. │               │
│  ├──┼────────────┼────┼───┼────┼────┼──────┼──────┤               │
│  │🥇│Benz Oficia │Ext │ 3 │100%│3.4h│$2.5K │$850  │               │
│  │🥈│Taller Inter│Int │ 2 │ 50%│4.0h│$980  │$490  │               │
│  └──┴────────────┴────┴───┴────┴────┴──────┴──────┘               │
├─────────────────────────────────────────────────────────────────────┤
│  ⚠️ Top Fallas + 📦 Top Piezas                                      │
│  ┌──────────────────────┬──────────────────────┐                   │
│  │ 1. Eléctrico (5x)    │ 1. Filtro aceite (12)│                   │
│  │    $450.00           │    $540.00           │                   │
│  │ 2. Mecánico (3x)     │ 2. Pastillas (8)     │                   │
│  │    $320.00           │    $280.00           │                   │
│  │ ...                  │ ...                  │                   │
│  └──────────────────────┴──────────────────────┘                   │
├─────────────────────────────────────────────────────────────────────┤
│  Acciones Rápidas                                                   │
│  [🚛 Gestionar Vehículos] [🔧 Órdenes] [📦 Nueva OT]               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📐 Dimensiones y Grid System

### Responsive Breakpoints
- **Mobile:** `< 768px` → 1 columna
- **Tablet:** `768px - 1024px` → 2 columnas
- **Desktop:** `> 1024px` → 6 columnas (KPIs)

### Spacing
- **Gap entre secciones:** `24px` (space-y-6)
- **Gap entre cards:** `16px` (gap-4)
- **Padding interno cards:** `16px-24px`

---

## 🎨 Paleta de Colores (Tokens)

### Estados de Vehículos
```css
• Activo:    #10b981 (green-600)
• En Taller: #f59e0b (yellow-600)
• Inactivo:  #ef4444 (red-600)
```

### KPIs
```css
• Disponibilidad: #10b981 (green-600)
• MTTR:          #3b82f6 (blue-600)
• MTBF:          #a855f7 (purple-600)
• Costo:         #ef4444 (red-600)
• SLA:           #10b981 (green-600)
```

### SLA Performance
```css
• Excelente (≥80%):  #10b981 (green-600)
• Aceptable (≥60%):  #f59e0b (yellow-600)
• Bajo (<60%):       #ef4444 (red-600)
```

### Badges
```css
• Interno:  bg-primary (azul #0A66C2)
• Externo:  bg-secondary (gris #F3F4F6)
• Urgente:  bg-yellow-100 text-yellow-800
• Vencido:  bg-red-100 text-red-800
```

---

## 📊 Componentes UI

### KPI Card
```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm text-muted-foreground">
      {icon} {titulo}
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-semibold {color}">
      {valor}
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      {descripcion}
    </p>
  </CardContent>
</Card>
```

### Filtro Input
```tsx
<div className="space-y-2">
  <Label htmlFor="id">{label}</Label>
  <Input
    id="id"
    type="date|text"
    value={value}
    onChange={handler}
  />
</div>
```

### Filtro Select
```tsx
<div className="space-y-2">
  <Label htmlFor="id">{label}</Label>
  <Select value={value} onValueChange={handler}>
    <SelectTrigger id="id">
      <SelectValue placeholder="placeholder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">Todos</SelectItem>
      {options.map(opt => (
        <SelectItem key={opt.value} value={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### Ranking Item (Talleres)
```tsx
<TableRow>
  <TableCell>
    {rank === 1 && '🥇'}
    {rank === 2 && '🥈'}
    {rank === 3 && '🥉'}
    {rank > 3 && rank}
  </TableCell>
  <TableCell className="font-medium">{nombre}</TableCell>
  <TableCell>
    <Badge variant={tipo === 'interno' ? 'default' : 'secondary'}>
      {tipo}
    </Badge>
  </TableCell>
  <TableCell className="text-right">{otsCount}</TableCell>
  <TableCell className="text-right">
    <span className={slaPct >= 80 ? 'text-green-600' : 'text-yellow-600'}>
      {slaPct}%
    </span>
  </TableCell>
  <TableCell className="text-right">{mttr}h</TableCell>
  <TableCell className="text-right font-medium">{costoTotal}</TableCell>
  <TableCell className="text-right text-muted-foreground">{costoPromedio}</TableCell>
</TableRow>
```

### Top Item (Fallas/Piezas)
```tsx
<div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
  <div className="flex items-center gap-3 flex-1">
    <div className="size-8 rounded-full bg-red-100 flex items-center justify-center">
      {rank}
    </div>
    <div className="flex-1">
      <p className="font-medium">{descripcion}</p>
      <p className="text-sm text-muted-foreground">
        {count} ocurrencia{count !== 1 ? 's' : ''}
      </p>
    </div>
  </div>
  <div className="text-right">
    <p className="font-semibold text-red-600">{costoTotal}</p>
    <p className="text-xs text-muted-foreground">{costoPorUnidad}/ocurr.</p>
  </div>
</div>
```

---

## 🔄 Estados de Carga

### Initial Load
```tsx
if (!metrics) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <RefreshCw className="size-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Cargando métricas...</p>
      </div>
    </div>
  );
}
```

### Empty State (Sin datos)
```tsx
<div className="text-center py-8 text-muted-foreground">
  <AlertTriangle className="size-12 mx-auto mb-2 opacity-50" />
  <p>No hay datos de fallas registradas</p>
</div>
```

### Error State
```tsx
<Alert variant="destructive">
  <AlertCircle className="size-4" />
  <AlertDescription>
    Error al cargar métricas. Intente nuevamente.
  </AlertDescription>
</Alert>
```

---

## ⚡ Interacciones

### Filtros
- **onChange**: Recalcula métricas automáticamente (useMemo)
- **Clear Filters**: Resetea todos los filtros a string vacío
- **Visual feedback**: Botón "Limpiar Filtros" solo visible si hay filtros activos

### Cards Clickeables
```tsx
<Card 
  className="cursor-pointer hover:shadow-md transition-shadow"
  onClick={() => onNavigate('/ruta')}
>
  {/* contenido */}
</Card>
```

### Navegación
- **Ver Todos** → Navega a lista completa
- **Nueva OT** → Navega a formulario con parámetros pre-llenados
- **Click en fila** → Navega a detalle del vehículo

---

## 📱 Responsive Behavior

### Mobile (< 768px)
```
KPIs:          1 columna
Filtros:       1 columna apilados
Tablas:        Scroll horizontal
Gráficos:      Stack vertical
Acciones:      Stack vertical
```

### Tablet (768px - 1024px)
```
KPIs:          2 columnas
Filtros:       2 columnas
Tablas:        Completas
Gráficos:      2 columnas
Acciones:      2 columnas
```

### Desktop (> 1024px)
```
KPIs:          6 columnas
Filtros:       4 columnas
Tablas:        Completas
Gráficos:      2 columnas
Acciones:      3 columnas
```

---

## 🎯 Prioridades Visuales

### Nivel 1 (Crítico - Always Visible)
- KPIs Enterprise (6 métricas principales)
- Alertas de vehículos críticos

### Nivel 2 (Importante - Above Fold)
- Filtros de dashboard
- KPIs de vehículos
- KPIs de OTs

### Nivel 3 (Informativo - Scroll)
- Tabla de vehículos críticos
- Gráficos analíticos
- Ranking de talleres

### Nivel 4 (Detalle - Lower Scroll)
- Top fallas
- Top piezas
- Acciones rápidas

---

## 🧪 Test Visual Checklist

- [ ] KPIs muestran valores correctos sin NaN/undefined
- [ ] Colores semánticos aplicados correctamente
- [ ] Badges con variantes correctas
- [ ] Gráficos responsivos en todos los breakpoints
- [ ] Tablas con scroll horizontal en mobile
- [ ] Hover effects funcionan en cards clickeables
- [ ] Empty states visibles cuando no hay datos
- [ ] Botón "Limpiar Filtros" aparece/desaparece correctamente
- [ ] Medallas (🥇🥈🥉) en top 3 de ranking
- [ ] Progress bar de disponibilidad funcional
- [ ] Timestamp de actualización dinámico
- [ ] Indicador "sistema operativo" con animación

---

**Última actualización:** 2025-02-11  
**Versión:** 1.0.0  
**Estado:** ✅ Implementado y validado
