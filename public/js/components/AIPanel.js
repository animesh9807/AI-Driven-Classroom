// Inside public/AIPanel.js - Updated AIPanel Component

function AIPanel(props) {
    var matchHistory = props.matchHistory || [];
    var [materialData, setMaterialData] = React.useState(props.material || null);
    var pdfTopics = (materialData && materialData.chunks) || props.pdfTopics || [];

    var s1 = React.useState(false); var open = s1[0], setOpen = s1[1];
    var s2 = React.useState('pdf'); var mainTab = s2[0], setMainTab = s2[1];
    var s3 = React.useState(0); var selectedLiveIndex = s3[0], setSelectedLiveIndex = s3[1];
    var s4 = React.useState(0); var selectedPdfIndex = s4[0], setSelectedPdfIndex = s4[1];
    var s5 = React.useState('diagrams'); var activeSubTab = s5[0], setActiveSubTab = s5[1];

    // Background Polling for Asynchronous Material Processing
    React.useEffect(function () {
        var materialId = props.materialId || (props.material && props.material.id);
        if (!materialId) return;

        var interval = setInterval(function () {
            if (materialData && (materialData.status === 'ready' || materialData.status === 'error')) {
                clearInterval(interval);
                return;
            }

            fetch('/api/material/' + materialId, {
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') }
            })
            .then(function (res) { return res.json(); })
            .then(function (updated) {
                if (updated && updated.id) {
                    setMaterialData(updated);
                    if (updated.status === 'ready') clearInterval(interval);
                }
            })
            .catch(function (err) { console.warn('Background poll warning:', err); });
        }, 2000);

        return function () { clearInterval(interval); };
    }, [props.materialId, materialData && materialData.status]);

    function toggleOpen() {
        var next = !open;
        setOpen(next);
        if (next && props.onOpened) props.onOpened();
    }

    var current = mainTab === 'live' ? matchHistory[selectedLiveIndex] : pdfTopics[selectedPdfIndex];
    var isProcessing = materialData && (materialData.status === 'processing' || materialData.status === 'extracting' || materialData.status === 'analyzing');
    var hasFailed = materialData && materialData.status === 'error';

    function retryProcessing() {
        var materialId = props.materialId || (props.material && props.material.id);
        if (!materialId) return;
        fetch('/api/material/' + materialId + '/retry', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') }
        }).then(function () {
            setMaterialData(Object.assign({}, materialData, { status: 'processing', progress: 5 }));
        });
    }

    var activeCards = [];
    if (current && current.flashcards) {
        if (activeSubTab === 'diagrams') {
            activeCards = current.flashcards.diagrams || current.flashcards['3d'] || [];
        } else {
            activeCards = current.flashcards[activeSubTab] || [];
        }
    }

    return (
        <div className="fab-wrap">
            <button className={"round-fab ai" + (props.hasNewMatch && !open ? " pulse" : "")} onClick={toggleOpen} title="AI Teaching Assistant">
                {open ? <span style={{ fontSize: 20 }}>✕</span> : <AIIcon size={28} />}
                {!open && props.hasNewMatch && <span className="dot"></span>}
            </button>

            {open && (
                <div className="ai-panel">
                    <div className="ai-panel-header">
                        <h3>🤖 AI Teaching Assistant</h3>
                        <button className="ai-panel-close" onClick={function () { setOpen(false); }}>✕</button>
                    </div>

                    <div className="ai-main-tabs">
                        <button className={mainTab === 'live' ? 'active' : ''} onClick={function () { setMainTab('live'); }}>🔴 Live Topic</button>
                        <button className={mainTab === 'pdf' ? 'active' : ''} onClick={function () { setMainTab('pdf'); }}>📄 PDF Topics</button>
                    </div>

                    {/* Non-blocking background status header */}
                    {isProcessing && (
                        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 14px', fontSize: '12px', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>⚡ Analyzing topics in background ({materialData.progress || 10}%)...</span>
                            <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                        </div>
                    )}

                    {hasFailed && (
                        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '8px 14px', fontSize: '12px', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>⚠️ Topic analysis encountered an issue.</span>
                            <button onClick={retryProcessing} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px' }}>Retry</button>
                        </div>
                    )}

                    <div className="ai-panel-body">
                        <div className="ai-topics-col">
                            <p className="ai-topics-label">{mainTab === 'live' ? 'Detected while teaching' : 'All topics in this PDF'}</p>

                            {mainTab === 'live' && matchHistory.length === 0 && (
                                <p className="empty-hint-sm">🎙️ Start listening — topics appear here as you speak.</p>
                            )}
                            {mainTab === 'live' && matchHistory.map(function (m, i) {
                                return (
                                    <div key={i} className={"ai-topic-item" + (i === selectedLiveIndex ? " active" : "")} onClick={function () { setSelectedLiveIndex(i); }}>
                                        {i === 0 && <span className="live-dot"></span>}
                                        <span>{m.topic}</span>
                                    </div>
                                );
                            })}

                            {mainTab === 'pdf' && pdfTopics.length === 0 && isProcessing && (
                                <p className="empty-hint-sm">Analyzing PDF concepts in background. You can present slides right now!</p>
                            )}
                            {mainTab === 'pdf' && pdfTopics.map(function (t, i) {
                                return (
                                    <div key={i} className={"ai-topic-item" + (i === selectedPdfIndex ? " active" : "")} onClick={function () { setSelectedPdfIndex(i); }}>
                                        <span>{t.topic}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="ai-content-col">
                            {current ? (
                                <React.Fragment>
                                    <div className="ai-tabs">
                                        <button className={activeSubTab === 'diagrams' ? 'active' : ''} onClick={function () { setActiveSubTab('diagrams'); }}>📐 Diagrams</button>
                                        <button className={activeSubTab === 'animation' ? 'active' : ''} onClick={function () { setActiveSubTab('animation'); }}>🎞️ Animation</button>
                                        <button className={activeSubTab === 'simulation' ? 'active' : ''} onClick={function () { setActiveSubTab('simulation'); }}>⚙️ Simulation</button>
                                        <button className={activeSubTab === 'quiz' ? 'active' : ''} onClick={function () { setActiveSubTab('quiz'); }}>📝 Quiz</button>
                                    </div>
                                    <div className="ai-tab-content">
                                        {activeSubTab !== 'quiz' && (
                                            <div className="flashcard-grid">
                                                {activeCards.map(function (card, i) {
                                                    return <FlashCard key={card.id || i} card={card} />;
                                                })}
                                                {activeCards.length === 0 && (
                                                    <p className="empty-hint-sm">Content generating for this topic...</p>
                                                )}
                                            </div>
                                        )}
                                        {activeSubTab === 'quiz' && (
                                            <QuizView quiz={current.quiz || []} topic={current.topic} onSendQuiz={props.onSendQuiz} />
                                        )}
                                    </div>
                                </React.Fragment>
                            ) : (
                                <p className="empty-hint">
                                    {isProcessing ? "Analyzing lesson concepts in background. Slides are ready to present!" : "Select a topic on the left."}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function FlashCard(props) {
    var card = props.card || {};
    var isDiagram = card.type === 'diagram' || Boolean(card.imageUrl);
    var s1 = React.useState(false); var isMaximized = s1[0], setIsMaximized = s1[1];
    var s2 = React.useState(false); var imgError = s2[0], setImgError = s2[1];

    var embedUrl = card.imageUrl || card.embedUrl || card.url || card.src || '';

    function handleDragStart(e) {
        var payload = Object.assign({}, card, {
            url: embedUrl,
            embedUrl: embedUrl,
            imageUrl: embedUrl,
            embeddable: true
        });
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
    }

    return (
        <React.Fragment>
            <div className="flashcard" draggable={true} onDragStart={handleDragStart}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="flashcard-title" style={{ flex: 1, paddingRight: 8 }}>{card.title}</div>
                    {embedUrl && (
                        <button 
                            type="button"
                            title="Maximize / Enlarge"
                            onClick={function (e) { e.stopPropagation(); setIsMaximized(true); }}
                            style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '12px' }}
                        >
                            ⛶ Expand
                        </button>
                    )}
                </div>
                <div className="flashcard-desc">{card.description}</div>
                
                <div className="flashcard-actions" style={{ marginBottom: 8 }}>
                    <span className="flashcard-drag-hint">✋ Drag onto slide</span>
                </div>

                {/* Direct Visual Container - Non-scrollable with object-fit: contain */}
                <div style={{
                    width: '100%',
                    height: '210px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: isDiagram ? '#ffffff' : '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    {isDiagram && embedUrl ? (
                        !imgError ? (
                            <img 
                                src={embedUrl} 
                                alt={card.title} 
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    padding: '6px',
                                    boxSizing: 'border-box',
                                    display: 'block'
                                }}
                                onError={function () { setImgError(true); }}
                            />
                        ) : (
                            <p className="empty-hint-sm">Diagram image preview unavailable.</p>
                        )
                    ) : embedUrl ? (
                        <iframe 
                            title={card.title} 
                            src={embedUrl} 
                            style={{ width: '100%', height: '100%', border: 'none', overflow: 'hidden' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                            allowFullScreen={true}
                            scrolling="no"
                        ></iframe>
                    ) : (
                        <p className="empty-hint-sm">Content preview unavailable.</p>
                    )}
                </div>
            </div>

            {/* Maximized Overlay Modal */}
            {isMaximized && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    zIndex: 99999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    boxSizing: 'border-box'
                }}>
                    <div style={{
                        width: '90%',
                        maxWidth: '1000px',
                        background: '#1e293b',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: '#0f172a',
                            color: '#ffffff',
                            borderBottom: '1px solid #334155'
                        }}>
                            <span style={{ fontWeight: 600, fontSize: '15px' }}>{card.title}</span>
                            <button 
                                onClick={function () { setIsMaximized(false); }}
                                style={{
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '13px'
                                }}
                            >
                                ✕ Minimize / Close
                            </button>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '580px',
                            background: isDiagram ? '#ffffff' : '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                        }}>
                            {isDiagram ? (
                                <img 
                                    src={embedUrl} 
                                    alt={card.title} 
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                        padding: '16px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            ) : (
                                <iframe 
                                    title={card.title} 
                                    src={embedUrl} 
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                                    allowFullScreen={true}
                                ></iframe>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
}

function QuizView(props) {
    var quiz = props.quiz || [];
    var s1 = React.useState({}); var answers = s1[0], setAnswers = s1[1];
    var s2 = React.useState(false); var submitted = s2[0], setSubmitted = s2[1];
    var s3 = React.useState(false); var sent = s3[0], setSent = s3[1];

    if (!quiz.length) return <p className="empty-hint-sm">No quiz generated for this topic yet.</p>;

    function selectAnswer(qIndex, optIndex) {
        if (submitted) return;
        setAnswers(function (prev) { var c = Object.assign({}, prev); c[qIndex] = optIndex; return c; });
    }

    var score = 0;
    if (submitted) quiz.forEach(function (q, i) { if (answers[i] === q.answerIndex) score++; });

    function handleSend() {
        if (props.onSendQuiz) {
            props.onSendQuiz(props.topic, quiz);
            setSent(true);
            setTimeout(function () { setSent(false); }, 2000);
        }
    }

    return (
        <div className="quiz-view">
            {quiz.map(function (q, qi) {
                return (
                    <div className="quiz-question" key={qi}>
                        <p className="quiz-q-text">{qi + 1}. {q.question}</p>
                        <div className="quiz-options">
                            {q.options.map(function (opt, oi) {
                                var cls = "quiz-option";
                                if (answers[qi] === oi) cls += " selected";
                                if (submitted && oi === q.answerIndex) cls += " correct";
                                if (submitted && answers[qi] === oi && oi !== q.answerIndex) cls += " wrong";
                                return <div key={oi} className={cls} onClick={function () { selectAnswer(qi, oi); }}>{opt}</div>;
                            })}
                        </div>
                    </div>
                );
            })}
            {!submitted ? (
                <button className="btn" onClick={function () { setSubmitted(true); }}>Submit Quiz</button>
            ) : (
                <p className="quiz-score">Score: {score} / {quiz.length}</p>
            )}
            {props.onSendQuiz && (
                <button className="btn secondary quiz-send-btn" onClick={handleSend}>
                    {sent ? '✅ Sent to students!' : '📤 Send this quiz to students'}
                </button>
            )}
        </div>
    );
}