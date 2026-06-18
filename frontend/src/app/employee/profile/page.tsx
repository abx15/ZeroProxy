'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Shield, Key, CheckCircle, Camera } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import api, { usersApi, aiApi } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { FaceCamera } from '@/components/employee/FaceCamera';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

const passwordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [showFaceRegister, setShowFaceRegister] = useState(false);
  const [isFaceRegistering, setIsFaceRegistering] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onRegisterFace = async (imageBase64: string) => {
    setIsFaceRegistering(true);
    try {
      await aiApi.registerFace(imageBase64);
      toast.success('Face registered successfully!');
      updateUser({ faceRegistered: true });
      setShowFaceRegister(false);
    } catch {
      toast.error('Face registration failed. Try again.');
    } finally {
      setIsFaceRegistering(false);
    }
  };

  const onChangePassword = async (data: PasswordForm) => {
    if (!user) return;
    setIsChangingPassword(true);
    try {
      await usersApi.update(user.id, {});
      await api.patch(`/users/${user.id}/password`, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password changed successfully!');
      reset();
    } catch {
      toast.error('Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-main">My Profile</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your account and face registration</p>
      </div>

      {/* Profile Card */}
      <div className="zp-card">
        <div className="flex items-center gap-5 flex-wrap">
          <Avatar name={user.name} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-text-main">{user.name}</h2>
            <p className="text-slate-500 text-sm">{user.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant={user.role === 'ADMIN' ? 'error' : user.role === 'HR' ? 'warning' : 'info'}>
                {user.role}
              </Badge>
              {user.faceRegistered ? (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3" />
                  Face Registered
                </Badge>
              ) : (
                <Badge variant="warning">Face Not Registered</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Face Registration */}
      <div className="zp-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-text-main">Face Authentication</h3>
              <p className="text-xs text-slate-400">
                {user.faceRegistered ? 'Your face is registered for secure login' : 'Register your face to enable face login'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFaceRegister(!showFaceRegister)}
            className={`${showFaceRegister ? 'zp-btn-secondary' : 'zp-btn-primary'} cursor-pointer`}
          >
            <Camera className="w-4 h-4 inline mr-1.5" />
            {user.faceRegistered ? 'Update Face' : 'Register Face'}
          </button>
        </div>

        {showFaceRegister && (
          <div className="pt-2 border-t border-border flex flex-col items-center gap-4 animate-fade-in">
            <p className="text-sm text-slate-500 text-center">
              Face directly at the camera in good lighting, then click Register.
            </p>
            <FaceCamera
              onCapture={(imageBase64) => onRegisterFace(imageBase64)}
              isProcessing={isFaceRegistering}
              mode="register"
            />
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="zp-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center">
            <Key className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <h3 className="font-semibold text-text-main">Change Password</h3>
            <p className="text-xs text-slate-400">Update your login password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onChangePassword)} className="space-y-3">
          {[
            { name: 'currentPassword' as const, label: 'Current Password', placeholder: '••••••••' },
            { name: 'newPassword' as const, label: 'New Password', placeholder: 'Min 8 characters' },
            { name: 'confirmPassword' as const, label: 'Confirm New Password', placeholder: 'Repeat new password' },
          ].map(({ name, label, placeholder }) => (
            <div key={name} className="space-y-1">
              <label className="text-sm font-medium text-text-main">{label}</label>
              <input {...register(name)} type="password" placeholder={placeholder} className="zp-input" />
              {errors[name] && <p className="text-xs text-red-500">{errors[name]?.message}</p>}
            </div>
          ))}

          <button type="submit" disabled={isChangingPassword} className="zp-btn-primary flex items-center gap-2 cursor-pointer">
            {isChangingPassword ? <Spinner size="sm" /> : null}
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
