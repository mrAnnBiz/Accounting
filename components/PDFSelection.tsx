import React from 'react';
import { useRouter } from 'next/navigation';

export const PDFSelection: React.FC = () => {
  const router = useRouter();

  const samplePapers = [
    {
      id: '9706_s23_qp_32',
      name: 'Accounting 9706 - Summer 2023 - Paper 32',
      description: 'Advanced Financial Accounting question paper',
      type: 'Question Paper'
    },
    {
      id: '9706_w22_qp_31',
      name: 'Accounting 9706 - Winter 2022 - Paper 31', 
      description: 'Advanced Financial Accounting question paper',
      type: 'Question Paper'
    },
    {
      id: '9706_s22_qp_32',
      name: 'Accounting 9706 - Summer 2022 - Paper 32',
      description: 'Advanced Financial Accounting question paper', 
      type: 'Question Paper'
    }
  ];

  const handlePaperSelect = (paperId: string) => {
    router.push(`/past-papers/viewer?paper=${paperId}`);
  };

  const handleSampleDemo = () => {
    // Use a publicly available sample PDF for testing
    const demoUrl = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';
    router.push(`/past-papers/viewer?paper=demo&url=${encodeURIComponent(demoUrl)}`);
  };

  return (
    <div style={containerStyle}>
      {/* Navigation */}
      <div style={navStyle}>
        <button 
          onClick={() => router.push('/past-papers')}
          style={backButtonStyle}
        >
          ← Back to Past Papers
        </button>
      </div>

      {/* Main Content */}
      <div style={contentStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Select a PDF to Annotate</h1>
          <p style={descriptionStyle}>
            Choose a Cambridge International Accounting paper to start annotating with our advanced PDF annotation system.
          </p>
        </div>

        {/* Demo Section */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Quick Demo</h2>
          <div style={demoCardStyle}>
            <div style={cardContentStyle}>
              <h3 style={cardTitleStyle}>🎯 Try the Annotation System</h3>
              <p style={cardDescriptionStyle}>
                Test all annotation features with a sample PDF document
              </p>
              <button 
                onClick={handleSampleDemo}
                style={primaryButtonStyle}
              >
                Launch Demo PDF
              </button>
            </div>
          </div>
        </div>

        {/* Sample Papers Section */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Cambridge International Accounting Papers</h2>
          <p style={sectionDescriptionStyle}>
            Select from available question papers (Note: These are sample entries for demonstration)
          </p>
          
          <div style={papersGridStyle}>
            {samplePapers.map((paper) => (
              <div 
                key={paper.id} 
                style={paperCardStyle}
                onClick={() => handlePaperSelect(paper.id)}
              >
                <div style={cardHeaderStyle}>
                  <span style={typeTagStyle}>{paper.type}</span>
                </div>
                <div style={cardContentStyle}>
                  <h3 style={cardTitleStyle}>{paper.name}</h3>
                  <p style={cardDescriptionStyle}>{paper.description}</p>
                  <button style={secondaryButtonStyle}>
                    Open for Annotation →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upload Section */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Upload Your Own PDF</h2>
          <div style={uploadCardStyle}>
            <div style={cardContentStyle}>
              <h3 style={cardTitleStyle}>📄 Custom PDF Upload</h3>
              <p style={cardDescriptionStyle}>
                Upload your own Cambridge International papers or other PDFs
              </p>
              <div style={uploadAreaStyle}>
                <p style={uploadTextStyle}>
                  Drag and drop your PDF here, or click to browse
                </p>
                <input 
                  type="file" 
                  accept=".pdf"
                  style={fileInputStyle}
                  onChange={(e) => {
                    // TODO: Implement file upload functionality
                    console.log('File selected:', e.target.files?.[0]);
                    alert('File upload functionality will be implemented in the next phase');
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Features Preview */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Annotation Features</h2>
          <div style={featuresGridStyle}>
            <div style={featureStyle}>
              <div style={featureIconStyle}>✏️</div>
              <h4>Pen & Highlighter</h4>
              <p>Natural drawing with pressure sensitivity</p>
            </div>
            <div style={featureStyle}>
              <div style={featureIconStyle}>📝</div>
              <h4>Text Annotations</h4>
              <p>Add formatted text with inline editing</p>
            </div>
            <div style={featureStyle}>
              <div style={featureIconStyle}>⬜</div>
              <h4>Shapes & Arrows</h4>
              <p>Geometric shapes and directional arrows</p>
            </div>
            <div style={featureStyle}>
              <div style={featureIconStyle}>🎨</div>
              <h4>Professional Tools</h4>
              <p>Color picker, properties editor, zoom controls</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Styles
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#f8f9fa'
};

const navStyle: React.CSSProperties = {
  padding: '16px 24px',
  backgroundColor: 'white',
  borderBottom: '1px solid #e0e0e0'
};

const backButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'transparent',
  border: '1px solid #ddd',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#666',
  textDecoration: 'none'
};

const contentStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '40px 24px'
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '48px'
};

const titleStyle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 'bold',
  color: '#333',
  marginBottom: '16px'
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '18px',
  color: '#666',
  lineHeight: '1.6'
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '48px'
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#333',
  marginBottom: '8px'
};

const sectionDescriptionStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#666',
  marginBottom: '24px'
};

const demoCardStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  borderRadius: '12px',
  overflow: 'hidden',
  color: 'white'
};

const papersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '24px'
};

const paperCardStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '1px solid #e0e0e0',
  overflow: 'hidden',
  cursor: 'pointer',
  transition: 'all 0.2s',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
};

const cardHeaderStyle: React.CSSProperties = {
  padding: '16px 20px 0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const typeTagStyle: React.CSSProperties = {
  backgroundColor: '#e3f2fd',
  color: '#1565c0',
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: 'bold'
};

const cardContentStyle: React.CSSProperties = {
  padding: '20px'
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#333',
  marginBottom: '8px'
};

const cardDescriptionStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#666',
  lineHeight: '1.5',
  marginBottom: '16px'
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: 'white',
  color: '#2563eb',
  border: '2px solid white',
  padding: '12px 24px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 'bold'
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: 'white',
  border: 'none',
  padding: '10px 20px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px'
};

const uploadCardStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '2px dashed #ddd'
};

const uploadAreaStyle: React.CSSProperties = {
  padding: '32px',
  textAlign: 'center',
  position: 'relative'
};

const uploadTextStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#666',
  marginBottom: '16px'
};

const fileInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  borderRadius: '6px',
  border: '1px solid #ddd'
};

const featuresGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '24px'
};

const featureStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px',
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '1px solid #e0e0e0'
};

const featureIconStyle: React.CSSProperties = {
  fontSize: '32px',
  marginBottom: '16px'
};