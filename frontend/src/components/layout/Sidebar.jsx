import { useWallet } from '../../hooks/useWallet';

const roleConfigs = {
  university: {
    bgColor: 'bg-coral-soft',
    textColor: 'text-coral',
    label: 'UNIVERSITY',
    navItems: [
      { path: '/university/issue', label: 'Issue Certificate' },
      { path: '/university/pending', label: 'Pending Approvals' },
    ]
  },
  student: {
    bgColor: 'bg-verified-bg',
    textColor: 'text-verified-deep',
    label: 'STUDENT',
    navItems: [
      { path: '/student/certificates', label: 'My Certificates' },
    ]
  },
  employer: {
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-800',
    label: 'EMPLOYER',
    navItems: [
      { path: '/verify', label: 'Verify Certificate' },
    ]
  },
  knqa: {
    bgColor: 'bg-amber-bg',
    textColor: 'text-amber',
    label: 'KNQA',
    navItems: [
      { path: '/knqa/audit', label: 'Audit Registry' },
      { path: '/knqa/manage', label: 'Manage Issuers' },
    ]
  }
};

function Sidebar({ currentPath }) {
  const { role, address, truncateAddress } = useWallet();
  
  if (!role) return null;

  const config = roleConfigs[role] || roleConfigs.employer;
  
  return (
    <div className="w-52 bg-linen border-r border-cream-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-cream-border">
        <h1 className="font-serif text-[17px] text-ink mb-2">
          Certi<em className="not-italic italic text-coral">vert</em>
        </h1>
        
        {/* Role badge */}
        <div className={`inline-block px-2 py-1 rounded-sm ${config.bgColor} ${config.textColor}`}>
          <span className="font-sans text-[10px] font-medium tracking-[0.06em] uppercase">
            {config.label}
          </span>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {config.navItems.map((item) => {
            const isActive = currentPath === item.path;
            
            return (
              <li key={item.path}>
                <a
                  href={item.path}
                  className={`
                    block px-4 py-2 text-[13px] font-sans transition-colors duration-150
                    ${isActive 
                      ? 'bg-cream-soft text-ink font-medium border-l-2 border-coral' 
                      : 'text-muted hover:bg-cream-soft hover:text-ink-soft'
                    }
                  `}
                >
                  <span className="inline-block w-1 h-1 bg-cream-border rounded-full mr-2" />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* Footer - Wallet address */}
      <div className="p-4 border-t border-cream-border">
        <div className="font-mono text-[9px] text-faint">
          {truncateAddress(address)}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;