'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  FileText,
  Plus,
  Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const EXPENSE_CATEGORIES = [
  'alquiler',
  'sueldos',
  'materiales',
  'servicios',
  'marketing',
  'otros',
] as const

interface IncomeRow {
  id: string
  date: string
  client: string | null
  service: string | null
  staff: string | null
  amount: number
  payment_status: string | null
}

interface ExpenseRow {
  id: string
  date: string
  category: string
  description: string | null
  amount: number
  receipt_url: string | null
  notes: string | null
  created_at: string | null
}

interface KPIs {
  balance: number
  incomeMonth: number
  expensesMonth: number
  marginPercent: number
}

export function FinancesPageClient({
  businessId,
  incomeData,
  expenses,
  kpis,
}: {
  businessId: string
  incomeData: IncomeRow[]
  expenses: ExpenseRow[]
  kpis: KPIs
}) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('resumen')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'otros',
    description: '',
    amount: '',
    notes: '',
  })

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.from('expenses').insert({
      business_id: businessId,
      date: expenseForm.date,
      category: expenseForm.category,
      description: expenseForm.description || null,
      amount: Number(expenseForm.amount) || 0,
      notes: expenseForm.notes || null,
    })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setShowExpenseForm(false)
    setExpenseForm({
      date: format(new Date(), 'yyyy-MM-dd'),
      category: 'otros',
      description: '',
      amount: '',
      notes: '',
    })
    router.refresh()
  }

  const currency = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="flex w-full flex-row flex-wrap justify-start gap-2 h-auto p-1 bg-zinc-800 cursor-default">
        <TabsTrigger value="resumen" className="cursor-pointer gap-1.5">
          <DollarSign className="h-4 w-4" />
          Resumen
        </TabsTrigger>
        <TabsTrigger value="ingresos" className="cursor-pointer gap-1.5">
          <TrendingUp className="h-4 w-4" />
          Ingresos
        </TabsTrigger>
        <TabsTrigger value="gastos" className="cursor-pointer gap-1.5">
          <TrendingDown className="h-4 w-4" />
          Gastos
        </TabsTrigger>
        <TabsTrigger value="reportes" className="cursor-pointer gap-1.5">
          <FileText className="h-4 w-4" />
          Reportes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="resumen" className="mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="cursor-default">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Balance del mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-zinc-100">
                {currency(kpis.balance)}
              </p>
            </CardContent>
          </Card>
          <Card className="cursor-default">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Ingresos del mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">
                {currency(kpis.incomeMonth)}
              </p>
            </CardContent>
          </Card>
          <Card className="cursor-default">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Gastos del mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {currency(kpis.expensesMonth)}
              </p>
            </CardContent>
          </Card>
          <Card className="cursor-default">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Margen %
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-zinc-100">
                {kpis.marginPercent}%
              </p>
            </CardContent>
          </Card>
        </div>
        <Card className="cursor-default">
          <CardHeader>
            <CardTitle>Ingresos vs Gastos (mes actual)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              <div className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-emerald-500 rounded-t min-h-[4px] max-h-32"
                  style={{
                    height: `${
                      kpis.incomeMonth + kpis.expensesMonth > 0
                        ? (kpis.incomeMonth /
                            (kpis.incomeMonth + kpis.expensesMonth)) *
                          128
                        : 64
                    }px`,
                  }}
                />
                <span className="text-xs text-zinc-400">Ingresos</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-red-500 rounded-t min-h-[4px] max-h-32"
                  style={{
                    height: `${
                      kpis.incomeMonth + kpis.expensesMonth > 0
                        ? (kpis.expensesMonth /
                            (kpis.incomeMonth + kpis.expensesMonth)) *
                          128
                        : 64
                    }px`,
                  }}
                />
                <span className="text-xs text-zinc-400">Gastos</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ingresos" className="mt-6">
        <Card className="cursor-default">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ingresos (citas completadas)</CardTitle>
            <Button variant="outline" size="sm" className="cursor-pointer">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </CardHeader>
          <CardContent>
            {incomeData.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center">
                No hay ingresos este mes
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeData.map((row) => (
                      <TableRow key={row.id} className="cursor-default">
                        <TableCell className="text-zinc-100">
                          {format(new Date(row.date), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-zinc-100">
                          {row.client ?? '-'}
                        </TableCell>
                        <TableCell className="text-zinc-100">
                          {row.service ?? '-'}
                        </TableCell>
                        <TableCell className="text-zinc-100">
                          {row.staff ?? '-'}
                        </TableCell>
                        <TableCell className="font-medium text-zinc-100">
                          {currency(row.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.payment_status === 'paid'
                                ? 'paid'
                                : row.payment_status === 'partial'
                                  ? 'partial'
                                  : 'unpaid'
                            }
                          >
                            {row.payment_status ?? 'unpaid'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-4 text-sm font-medium text-zinc-100">
                  Total: {currency(incomeData.reduce((s, i) => s + i.amount, 0))}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="gastos" className="mt-6">
        <Card className="cursor-default">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Gastos</CardTitle>
            <Button
              className="cursor-pointer"
              onClick={() => setShowExpenseForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Añadir gasto
            </Button>
          </CardHeader>
          <CardContent>
            {showExpenseForm && (
              <form
                onSubmit={handleAddExpense}
                className="mb-6 p-4 rounded-lg border border-zinc-800 bg-zinc-950 space-y-4"
              >
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) =>
                        setExpenseForm((f) => ({ ...f, date: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Categoría</Label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) =>
                        setExpenseForm((f) => ({
                          ...f,
                          category: e.target.value,
                        }))
                      }
                      className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Input
                    value={expenseForm.description}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Descripción del gasto"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Monto (€)</Label>
                  <Input
                    type="number"
                    step={0.01}
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Notas</Label>
                  <Textarea
                    value={expenseForm.notes}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading} className="cursor-pointer">
                    {loading ? 'Guardando...' : 'Guardar gasto'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setShowExpenseForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
            {expenses.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center">
                No hay gastos registrados
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((row) => (
                      <TableRow key={row.id} className="cursor-default">
                        <TableCell className="text-zinc-100">
                          {format(new Date(row.date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-zinc-100">
                          {row.category}
                        </TableCell>
                        <TableCell className="text-zinc-100">
                          {row.description ?? '-'}
                        </TableCell>
                        <TableCell className="font-medium text-zinc-100 text-red-600">
                          {currency(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-4 text-sm font-medium text-zinc-100">
                  Total gastos:{' '}
                  {currency(expenses.reduce((s, e) => s + Number(e.amount), 0))}
                </p>
                <Button variant="outline" size="sm" className="mt-4 cursor-pointer">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="reportes" className="mt-6">
        <Card className="cursor-default">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reportes y gráficos</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="cursor-pointer">
                PDF
              </Button>
              <Button variant="outline" size="sm" className="cursor-pointer">
                Excel
              </Button>
              <Button variant="outline" size="sm" className="cursor-pointer">
                CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400 py-8 text-center">
              Gráficos por servicio, empleado, tendencia y gastos por categoría
              (próximamente).
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
