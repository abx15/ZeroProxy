'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Plus, MoreVertical, Shield, ShieldOff, Trash2 } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

const createUserSchema = z.object({
  name: z.string().min(2, 'Min 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
  role: z.enum(['ADMIN', 'HR', 'EMPLOYEE']),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

export default function EmployeesPage() {
  const { user: currentUser } = useAuthStore();
  const [employees, setEmployees] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'EMPLOYEE' },
  });

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      const res = await usersApi.getAll({ page, limit: 10, search: search || undefined });
      setEmployees(res.data.data.data);
      setMeta(res.data.data.meta);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadEmployees, 300);
    return () => clearTimeout(timer);
  }, [page, search]);

  const onCreateUser = async (data: CreateUserForm) => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      await usersApi.create({ ...data, companyId: currentUser.companyId });
      toast.success('Employee added successfully!');
      setShowAddModal(false);
      reset();
      loadEmployees();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await usersApi.update(id, { isActive: !isActive });
      toast.success(isActive ? 'Employee deactivated' : 'Employee activated');
      loadEmployees();
    } catch {}
    setActiveMenu(null);
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this employee?')) return;
    try {
      await usersApi.delete(id);
      toast.success('Employee removed');
      loadEmployees();
    } catch {}
    setActiveMenu(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Employees</h1>
          <p className="text-slate-500 text-sm mt-0.5">{meta?.total ?? 0} total employees</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="zp-btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or email..."
          className="zp-input pl-10"
        />
      </div>

      {/* Employee List */}
      <div className="zp-card space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : employees.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-slate-400">No employees found</p>
          </div>
        ) : (
          employees.map((emp: any) => (
            <div key={emp.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-background transition-colors relative">
              <div className="flex items-center gap-3">
                <Avatar name={emp.name} size="md" />
                <div>
                  <p className="text-sm font-medium text-text-main">{emp.name}</p>
                  <p className="text-xs text-slate-400">{emp.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={emp.role === 'ADMIN' ? 'error' : emp.role === 'HR' ? 'warning' : 'info'}>
                  {emp.role}
                </Badge>
                <Badge variant={emp.isActive ? 'success' : 'error'}>
                  {emp.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {emp.faceRegistered && <Shield className="w-3.5 h-3.5 text-success" />}

                <div className="relative">
                  <button
                    onClick={() => setActiveMenu(activeMenu === emp.id ? null : emp.id)}
                    className="p-1.5 rounded-lg hover:bg-card border border-border"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>

                  {activeMenu === emp.id && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-card rounded-xl shadow-modal border border-border py-1 z-10 animate-fade-in">
                      <button
                        onClick={() => toggleActive(emp.id, emp.isActive)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-background"
                      >
                        {emp.isActive ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                        {emp.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteUser(emp.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-red-50 text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <p className="text-xs text-slate-400">Page {meta.page} of {meta.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="zp-btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="zp-btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Employee">
        <form onSubmit={handleSubmit(onCreateUser)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-main">Full Name</label>
            <input {...register('name')} className="zp-input" placeholder="Ravi Kumar" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-main">Email</label>
            <input {...register('email')} type="email" className="zp-input" placeholder="ravi@company.com" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-main">Password</label>
            <input {...register('password')} type="password" className="zp-input" placeholder="Min 8 characters" />
            {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-main">Role</label>
            <select {...register('role')} className="zp-input">
              <option value="EMPLOYEE">Employee</option>
              <option value="HR">HR</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={isSubmitting} className="zp-btn-primary w-full flex items-center justify-center gap-2 mt-2">
            {isSubmitting && <Spinner size="sm" />}
            Add Employee
          </button>
        </form>
      </Modal>
    </div>
  );
}
