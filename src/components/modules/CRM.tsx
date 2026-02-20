import { UserCircle, TrendingUp, DollarSign, Users, Phone, Mail, Calendar, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

const oportunidades = [
  { id: '1', cliente: 'Hospital Regional Norte', etapa: 'Propuesta', valor: 450000, probabilidad: 70, responsable: 'Ana García' },
  { id: '2', cliente: 'Clínica San José', etapa: 'Negociación', valor: 280000, probabilidad: 85, responsable: 'Carlos López' },
  { id: '3', cliente: 'Centro Médico Los Andes', etapa: 'Prospección', valor: 180000, probabilidad: 30, responsable: 'María Torres' },
  { id: '4', cliente: 'Hospital Universitario', etapa: 'Cierre', valor: 520000, probabilidad: 95, responsable: 'José Ramírez' }
];

const clientes = [
  {
    id: '1',
    nombre: 'Hospital Regional Norte',
    contacto: 'Dr. Pedro Martínez',
    email: 'pmartinez@hrn.gob.pe',
    telefono: '+51 987 654 321',
    tipo: 'Público',
    ultimaInteraccion: '2024-12-03',
    valorTotal: 1250000
  },
  {
    id: '2',
    nombre: 'Clínica San José',
    contacto: 'Lic. Laura Vega',
    email: 'lvega@clinicasj.com',
    telefono: '+51 912 345 678',
    tipo: 'Privado',
    ultimaInteraccion: '2024-12-04',
    valorTotal: 850000
  }
];

export function CRM() {
  const totalValor = oportunidades.reduce((sum, o) => sum + o.valor, 0);
  const valorPonderado = oportunidades.reduce((sum, o) => sum + (o.valor * o.probabilidad / 100), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>CRM - Gestión de Clientes</h2>
          <p className="text-muted-foreground mt-1">Pipeline de ventas y relaciones con clientes</p>
        </div>
        <Button>
          <UserCircle className="size-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Oportunidades Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{oportunidades.length}</div>
            <p className="text-xs text-muted-foreground mt-1">En pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">S/ {(totalValor / 1000).toFixed(0)}K</div>
            <p className="text-xs text-muted-foreground mt-1">Pipeline completo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valor Ponderado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">S/ {(valorPonderado / 1000).toFixed(0)}K</div>
            <p className="text-xs text-muted-foreground mt-1">Proyectado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tasa de Cierre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">65%</div>
            <p className="text-xs text-green-600 mt-1">+5% vs mes anterior</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline de Oportunidades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {oportunidades.map((oportunidad) => (
                <div key={oportunidad.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{oportunidad.cliente}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Responsable: {oportunidad.responsable}
                      </p>
                    </div>
                    <Badge>{oportunidad.etapa}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="font-semibold">S/ {oportunidad.valor.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Probabilidad</p>
                      <p className="font-semibold">{oportunidad.probabilidad}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Ponderado</p>
                      <p className="font-semibold text-green-600">
                        S/ {((oportunidad.valor * oportunidad.probabilidad) / 100).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Progress value={oportunidad.probabilidad} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividades Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { tipo: 'call', cliente: 'Hospital Regional', accion: 'Llamada de seguimiento', tiempo: '2h' },
                { tipo: 'email', cliente: 'Clínica San José', accion: 'Envío de propuesta', tiempo: '5h' },
                { tipo: 'meeting', cliente: 'Centro Médico', accion: 'Reunión programada', tiempo: '1d' }
              ].map((act, i) => (
                <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="mt-1">
                    {act.tipo === 'call' && <Phone className="size-4 text-blue-600" />}
                    {act.tipo === 'email' && <Mail className="size-4 text-green-600" />}
                    {act.tipo === 'meeting' && <Calendar className="size-4 text-purple-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{act.accion}</p>
                    <p className="text-xs text-muted-foreground mt-1">{act.cliente}</p>
                    <p className="text-xs text-muted-foreground">Hace {act.tiempo}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Última Interacción</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nombre}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{cliente.contacto}</p>
                      <p className="text-xs text-muted-foreground">{cliente.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{cliente.tipo}</Badge>
                  </TableCell>
                  <TableCell>{cliente.ultimaInteraccion}</TableCell>
                  <TableCell>S/ {cliente.valorTotal.toLocaleString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Ver Detalle</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export * from './placeholders';