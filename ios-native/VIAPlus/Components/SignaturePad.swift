//
//  SignaturePad.swift
//  VIA+ — Pad de firma manuscrita.
//
//  Recreación nativa del SignaturePad (RN): lienzo donde se traza la firma
//  con el dedo o un lápiz táctil. Los trazos se guardan como polilíneas y se
//  pintan con `Canvas`. Botón para borrar. El padre observa `strokes` para
//  saber si hay firma (requisito para habilitar el botón de firmar).
//

import SwiftUI

struct SignaturePad: View {
    /// Trazos completados (cada uno es una polilínea de puntos).
    @Binding var strokes: [[CGPoint]]
    var height: CGFloat = 150
    var placeholder: String = "Firme aquí con el dedo o un lápiz táctil"

    @State private var current: [CGPoint] = []

    private var isEmpty: Bool { strokes.isEmpty && current.isEmpty }
    private let inkColor = Color(hex: "#3A3630")

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(hex: "#FBF9F4"))
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color(hex: "#E9E2D5"), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))

                Canvas { ctx, _ in
                    let style = StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round)
                    for stroke in strokes {
                        ctx.stroke(path(for: stroke), with: .color(inkColor), style: style)
                    }
                    ctx.stroke(path(for: current), with: .color(inkColor), style: style)
                }

                if isEmpty {
                    VStack(spacing: 4) {
                        Image(systemName: "signature")
                            .font(.system(size: 22))
                            .foregroundStyle(Color(hex: "#C9C1B2"))
                        Text(placeholder)
                            .font(.system(size: 11))
                            .foregroundStyle(Color(hex: "#B8B2A7"))
                    }
                    .allowsHitTesting(false)
                }
            }
            .frame(height: height)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in current.append(value.location) }
                    .onEnded { _ in
                        if current.count > 1 { strokes.append(current) }
                        current = []
                    }
            )

            HStack {
                Spacer()
                Button {
                    strokes = []
                    current = []
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "eraser")
                        Text("Borrar firma").font(.system(size: 13, weight: .bold))
                    }
                    .foregroundStyle(isEmpty ? Color(hex: "#C9C1B2") : VIA.muted)
                }
                .disabled(isEmpty)
            }
        }
    }

    private func path(for points: [CGPoint]) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        for point in points.dropFirst() { path.addLine(to: point) }
        return path
    }
}

#Preview {
    struct Demo: View {
        @State var strokes: [[CGPoint]] = []
        var body: some View { SignaturePad(strokes: $strokes).padding().background(VIA.cream) }
    }
    return Demo()
}
