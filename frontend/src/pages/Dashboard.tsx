import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Table2,
  Database,
  Users,
  Activity,
  Plus,
  Clock,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardStats } from '../types';

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  link,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  link?: string;
}) {
  const content = (
    <div className="card p-5 cursor-pointer group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {title}
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {value}
          </p>
        </div>
        <div className={`size-12 rounded-xl ${color} flex items-center justify-center shadow-lg`}>
          <Icon className="size-6 text-white" />
        </div>
      </div>
    </div>
  );

  if (link) return <Link to={link}>{content}</Link>;
  return content;
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await analyticsAPI.dashboard();
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="size-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Bonjour, {user?.firstName} 👋
        </h2>
        <p className="text-zinc-500 mt-1">Voici un aperçu de votre espace de travail</p>
      </div>

      {/* Quick action */}
      <Link
        to="/tables/new"
        className="flex items-center gap-3 p-4 bg-gradient-to-r from-gold-500 to-gold-600 rounded-xl text-white hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-400/20 group"
      >
        <div className="size-10 bg-white/15 rounded-lg flex items-center justify-center">
          <Plus className="size-5" />
        </div>
        <span className="font-semibold">Créer un nouveau tableau</span>
        <ChevronRight className="size-5 ml-auto group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Tableaux" value={stats?.totalTables ?? 0} icon={Table2} color="bg-accent-blue" link="/tables" />
        <StatCard title="Enregistrements" value={stats?.totalRows ?? 0} icon={Database} color="bg-accent-green" />
        {user?.role === 'ADMIN' && (
          <>
            <StatCard title="Utilisateurs" value={stats?.totalUsers ?? 0} icon={Users} color="bg-gold-400" link="/users" />
            <StatCard title="Actifs" value={stats?.activeUsers ?? 0} icon={Activity} color="bg-emerald-500" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tables */}
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <FileText className="size-4" style={{ color: 'var(--text-muted)' }} />
              Tableaux récents
            </h3>
            <Link to="/tables" className="text-xs font-medium text-accent-blue hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="p-0">
            {stats?.recentTables?.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-sm">
                <p>Aucun tableau pour le moment</p>
                <Link to="/tables/new" className="text-accent-blue hover:underline font-medium mt-1 inline-block">
                  Créer votre premier tableau
                </Link>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                {stats?.recentTables?.slice(0, 5).map((table) => (
                  <Link
                    key={table.id}
                    to={`/tables/${table.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: table.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {table.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {table._count?.columns ?? 0} colonnes · {table._count?.rows ?? 0} lignes
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Clock className="size-4" style={{ color: 'var(--text-muted)' }} />
              Activité récente
            </h3>
          </div>
          <div className="p-0">
            <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {stats?.recentChanges?.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-sm">
                  Aucune activité récente
                </div>
              ) : (
                stats?.recentChanges?.slice(0, 10).map((log) => (
                  <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                    <div className={`size-2 rounded-full mt-1.5 flex-shrink-0 ${
                      log.action === 'CREATE' ? 'bg-accent-green' :
                      log.action === 'UPDATE' ? 'bg-accent-orange' : 'bg-accent-error'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {log.user?.firstName} {log.user?.lastName}
                        </span>{' '}
                        {log.action === 'CREATE' ? 'a créé' :
                         log.action === 'UPDATE' ? 'a modifié' : 'a supprimé'} {log.entity?.toLowerCase()}
                        {log.table?.name && (
                          <> dans <span className="font-medium" style={{ color: 'var(--text-primary)' }}>"{log.table.name}"</span></>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
