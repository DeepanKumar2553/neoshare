import neoLogo from '../assets/neoshare-icon.png'
import '../App.css'

const NeoShare = () => {
  return (
    <div className="neoshare-title flex items-center justify-center gap-6">
      <img
        src={neoLogo}
        alt="NEO SHARE Logo"
        className="w-24 h-24 animate-spin-slow select-none pointer-events-none"
      />
      
      <h1 className="text-[3.5rem] font-bold text-[#00FFF7] tracking-widest neon-text select-none m-0 p-0">
        NEO SHARE
      </h1>
      
      <style>{`
        .neon-text {
          font-family: 'Orbitron', sans-serif;
          text-shadow:
            0 0 4px #00FFF7,
            0 0 8px #00FFF7,
            0 0 16px #00FFF7,
            0 0 32px #00BFBF,
            0 0 64px #008080;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NeoShare;
