import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { cpp } from "@codemirror/lang-cpp"
import { oneDark } from "@codemirror/theme-one-dark"
import { basicSetup } from "codemirror"

export type Editor = EditorView

export function initEditor(container: HTMLElement, initialValue: string): EditorView {
    const state = EditorState.create({
        doc: initialValue,
        extensions: [
            basicSetup,
            cpp(),
            oneDark,
        ],
    })
  
    const view = new EditorView({
        state,
        parent: container,
    })

    view.dom.classList.add('codemirror-fullheight');
  
    return view
}

export function getEditorValue(view: EditorView): string {
    return view.state.doc.toString()
}

export function setEditorValue(view: EditorView, newValue: string): void {
    const transaction = view.state.update({
        changes: {
        from: 0,
        to: view.state.doc.length,
        insert: newValue,
        },
    })
    view.dispatch(transaction)
}
