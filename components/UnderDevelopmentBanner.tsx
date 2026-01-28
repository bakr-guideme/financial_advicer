const UnderDevelopmentBanner = () => {
  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-50 overflow-hidden">
      <div 
        className="absolute bg-red-600 text-white text-sm font-bold py-2 text-center shadow-lg"
        style={{
          width: '300px',
          top: '40px',
          left: '-80px',
          transform: 'rotate(-45deg)',
        }}
      >
        UNDER DEVELOPMENT
      </div>
    </div>
  );
};

export default UnderDevelopmentBanner;