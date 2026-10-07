package br.davi.lexispredict.mobile;

import com.adobe.fre.FREContext;
import com.adobe.fre.FREExtension;

public class LexisWebExtension implements FREExtension {
    @Override public FREContext createContext(String extId) { return new LexisWebContext(); }
    @Override public void initialize() { }
    @Override public void dispose() { }
}
