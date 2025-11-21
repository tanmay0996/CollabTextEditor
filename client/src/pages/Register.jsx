// client/src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Toaster, toast } from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, User, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' }
  });

  const password = watch('password');
  const passwordStrength = getPasswordStrength(password);

  async function onSubmit(data) {
    setIsLoading(true);
    try {
      await api.post('/auth/register', { 
        name: data.name.trim(), 
        email: data.email.trim(), 
        password: data.password 
      });
      toast.success('Account created successfully!');
      setTimeout(() => navigate('/login'), 1000);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg || err.message;
      toast.error(typeof msg === 'string' ? msg : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      
      {/* Header */}
      <header className="p-6">
        <Link to="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors w-fit">
          <FileText className="w-6 h-6" />
          <span className="font-semibold text-lg">Collab Editor</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
              <p className="text-gray-500 mt-2">Start collaborating on documents today</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    {...register('name')}
                    disabled={isLoading}
                    className={`block w-full pl-10 pr-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 hover:bg-white focus:bg-white'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                    placeholder="John Doe"
                  />
                </div>
                {errors.name && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    disabled={isLoading}
                    className={`block w-full pl-10 pr-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 hover:bg-white focus:bg-white'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...register('password')}
                    disabled={isLoading}
                    className={`block w-full pl-10 pr-12 py-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 hover:bg-white focus:bg-white'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                    placeholder="Min. 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            level <= passwordStrength.level
                              ? passwordStrength.color
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs mt-1 ${passwordStrength.textColor}`}>
                      {passwordStrength.label}
                    </p>
                  </div>
                )}
                {errors.password && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                    disabled={isLoading}
                    className={`block w-full pl-10 pr-12 py-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 hover:bg-white focus:bg-white'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                    placeholder="Repeat your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start">
                <input
                  id="terms"
                  type="checkbox"
                  className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-600 cursor-pointer">
                  I agree to the{' '}
                  <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">Privacy Policy</a>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </button>
            </form>

            {/* Features List */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">What you'll get:</p>
              <ul className="space-y-2">
                {['Real-time collaboration', 'AI writing assistant', 'Auto-save & version history'].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sign In Link */}
          <p className="text-center mt-6 text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500">
        <p>© 2024 Collab Editor. All rights reserved.</p>
      </footer>
    </div>
  );
}

function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '', color: 'bg-gray-200', textColor: 'text-gray-500' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500', textColor: 'text-red-600' };
  if (score === 2) return { level: 2, label: 'Fair', color: 'bg-orange-500', textColor: 'text-orange-600' };
  if (score === 3) return { level: 3, label: 'Good', color: 'bg-yellow-500', textColor: 'text-yellow-600' };
  return { level: 4, label: 'Strong', color: 'bg-green-500', textColor: 'text-green-600' };
}