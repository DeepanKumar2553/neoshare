import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import type { JSX } from 'react';

interface PrivateRouteProps {
  children: JSX.Element;
  requiredAccess: 'sender' | 'receiver';
}

export default function PrivateRoute({
  children,
  requiredAccess
}: PrivateRouteProps) {
  const location = useLocation();
  const { senderAccess, receiverAccess } = useSelector((state: RootState) => state.access);

  const hasAccess = requiredAccess === 'sender'
    ? senderAccess
    : receiverAccess;

  if (!hasAccess) {
    return (
      <Navigate
        to={requiredAccess === 'sender' ? '/generate' : '/enter'}
        state={{
          from: location,
          message: `You need ${requiredAccess} access to view this page`
        }}
        replace
      />
    );
  }

  return children;
}