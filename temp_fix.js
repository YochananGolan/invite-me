// Temporary fix for the JSX structure
const fixedJSX = `
              {/* Invitation text editor with advanced formatting */}
              <div>
                <label className="block mb-1 font-bold text-right">אפשרות לשינוי נוסח הזמנה</label>
                <div className="border border-primary rounded-md p-3 bg-white">
                  <div className="flex justify-between items-center mb-3">
                    <button
                      onClick={addNewLine}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                    >
                      + הוסף שורה
                    </button>
                    <span className="text-sm text-gray-600">
                      {customInvitationText.split('\\n').length} שורות
                    </span>
                  </div>
                  
                  {customInvitationText.split('\\n').map((line, index) => (
                    <div key={index} className="mb-1 p-1 border border-gray-200 rounded bg-gray-50">
                      <div className="flex items-center gap-2">
                        {/* Text area */}
                        <div className="flex-1">
                          <textarea
                            value={line}
                            onChange={(e) => updateLineText(index, e.target.value)}
                            className="w-full border border-gray-300 rounded p-1 text-right"
                            style={{
                              fontSize: \`\${lineStyles[index]?.fontSize || 16}px\`,
                              color: lineStyles[index]?.color || 'black',
                              fontWeight: lineStyles[index]?.fontWeight || 'normal'
                            }}
                            rows={1}
                          />
                        </div>

                        {/* Right side - Icon controls in horizontal row */}
                        <div className="flex flex-col items-center gap-1">
                          {/* Icon descriptions for first row only */}
                          {index === 0 && (
                            <div className="flex gap-2 text-sm text-gray-700 font-bold">
                              <span className="w-8 text-center">גודל</span>
                              <span className="w-8 text-center">צבע</span>
                              <span className="w-8 text-center">הדגשה</span>
                              <span className="w-8 text-center">מחק</span>
                            </div>
                          )}
                          <div className="flex gap-2">
                            {/* Font Size Icon */}
                            <div className="relative group">
                              <button className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors" title="גודל פונט">
                                <span className="text-lg">🔤</span>
                              </button>
                              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <select
                                  value={lineStyles[index]?.fontSize || '16'}
                                  onChange={(e) => updateLineStyle(index, 'fontSize', e.target.value)}
                                  className="text-xs border-0 rounded p-2 w-20"
                                >
                                  <option value="12">12px</option>
                                  <option value="14">14px</option>
                                  <option value="16">16px</option>
                                  <option value="18">18px</option>
                                  <option value="20">20px</option>
                                  <option value="24">24px</option>
                                  <option value="28">28px</option>
                                  <option value="32">32px</option>
                                </select>
                              </div>
                            </div>

                            {/* Font Color Icon */}
                            <div className="relative group">
                              <button className="p-2 bg-green-100 hover:bg-green-200 rounded-lg transition-colors" title="צבע פונט">
                                <span className="text-lg">🎨</span>
                              </button>
                              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <select
                                  value={lineStyles[index]?.color || 'black'}
                                  onChange={(e) => updateLineStyle(index, 'color', e.target.value)}
                                  className="text-xs border-0 rounded p-2 w-20"
                                >
                                  <option value="black">שחור</option>
                                  <option value="red">אדום</option>
                                  <option value="blue">כחול</option>
                                  <option value="green">ירוק</option>
                                  <option value="purple">סגול</option>
                                  <option value="orange">כתום</option>
                                  <option value="brown">חום</option>
                                  <option value="gold">זהב</option>
                                </select>
                              </div>
                            </div>

                            {/* Font Weight Icon */}
                            <div className="relative group">
                              <button className="p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors" title="הדגשת פונט">
                                <span className="text-lg">💪</span>
                              </button>
                              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <select
                                  value={lineStyles[index]?.fontWeight || 'normal'}
                                  onChange={(e) => updateLineStyle(index, 'fontWeight', e.target.value)}
                                  className="text-xs border-0 rounded p-2 w-20"
                                >
                                  <option value="normal">רגיל</option>
                                  <option value="bold">מודגש</option>
                                  <option value="lighter">דק</option>
                                </select>
                              </div>
                            </div>

                            {/* Delete Icon */}
                            <button
                              onClick={() => deleteLine(index)}
                              className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                              title="מחק שורה"
                            >
                              <span className="text-lg">🗑️</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => setCustomInvitationText('')}
                    className="text-base underline font-bold text-primary hover:text-primary/80"
                  >חזרה לנוסח ברירת מחדל</button>
                </div>
                
                {/* Preview of formatted text */}
                <div className="mt-4 p-4 border border-gray-300 rounded bg-white">
                  <h3 className="text-lg font-bold mb-2 text-center">תצוגה מקדימה:</h3>
                  <div className="bg-gray-50 p-4 rounded border text-right">
                    {customInvitationText.split('\\n').map((line, index) => (
                      <div
                        key={index}
                        style={{
                          fontSize: \`\${lineStyles[index]?.fontSize || 16}px\`,
                          color: lineStyles[index]?.color || 'black',
                          fontWeight: lineStyles[index]?.fontWeight || 'normal',
                          marginBottom: '8px'
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
`;
