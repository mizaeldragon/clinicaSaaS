import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Pencil, Phone, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader, Pagination, TBody, TD, TH, THead, TR, Table } from '@/components/ui/data';
import { EmptyState, SkeletonTable } from '@/components/ui/feedback';
import { UserAvatar } from '@/components/ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCustomerMutations, useCustomers } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { phoneMask, shortDate } from '@/lib/format';
import { CustomerDialog } from './CustomerDialog';
import type { Customer } from '@/types';

export function CustomersPage() {
  const can = useAuthStore((s) => s.can);
  const canManage = can('customers:manage');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const debouncedSearch = useDebouncedValue(search, 350);
  const { data, isLoading } = useCustomers({ page, perPage: 20, search: debouncedSearch });
  const { remove } = useCustomerMutations();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Cadastro completo com histórico de atendimentos e valores gastos"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <UserPlus />
              Novo cliente
            </Button>
          ) : null
        }
      />

      <Card className="p-4">
        <Input
          icon={<Search />}
          placeholder="Buscar por nome, telefone ou e-mail..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-md"
        />
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-4">
            <SkeletonTable />
          </div>
        ) : data?.data.length ? (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Cliente</TH>
                    <TH>Contato</TH>
                    <TH>Atendimentos</TH>
                    <TH>Cadastro</TH>
                    <TH className="w-12" />
                  </TR>
                </THead>
                <TBody>
                  {data.data.map((customer) => (
                    <TR key={customer.id}>
                      <TD>
                        <Link
                          to={`/app/clientes/${customer.id}`}
                          className="flex items-center gap-3 hover:text-primary"
                        >
                          <UserAvatar name={customer.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{customer.name}</p>
                            {customer.email ? (
                              <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
                            ) : null}
                          </div>
                        </Link>
                      </TD>
                      <TD className="text-sm text-muted-foreground">
                        {phoneMask(customer.phone ?? customer.whatsapp)}
                      </TD>
                      <TD className="text-sm">{customer._count?.appointments ?? 0}</TD>
                      <TD className="text-sm text-muted-foreground">{shortDate(customer.createdAt)}</TD>
                      <TD>
                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Ações">
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(customer);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem destructive onSelect={() => remove.mutate(customer.id)}>
                                <Trash2 />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="divide-y md:hidden">
              {data.data.map((customer) => (
                <Link
                  key={customer.id}
                  to={`/app/clientes/${customer.id}`}
                  className="flex items-center gap-3 p-4 active:bg-muted"
                >
                  <UserAvatar name={customer.name} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{customer.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Phone className="size-3" />
                      {phoneMask(customer.phone ?? customer.whatsapp)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {customer._count?.appointments ?? 0} atend.
                  </span>
                </Link>
              ))}
            </div>

            <div className="px-4">
              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                total={data.meta.total}
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={Users}
            title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            description={
              search
                ? 'Tente buscar por outro nome ou telefone.'
                : 'Cadastre seu primeiro cliente para começar a agendar atendimentos.'
            }
            action={canManage && !search ? { label: 'Novo cliente', onClick: openCreate } : undefined}
          />
        )}
      </Card>

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} customer={editing} />
    </div>
  );
}
