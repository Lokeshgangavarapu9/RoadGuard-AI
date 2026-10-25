package com.roadguard.api;

import ai.onnxruntime.*;
import org.junit.jupiter.api.Test;

import java.io.File;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class OnnxModelInspectTest {

    @Test
    public void testInspectModelMetadata() throws OrtException {
        File modelFile = new File("./models/road_damage_yolo.onnx");
        assertTrue(modelFile.exists(), "Model file should exist: " + modelFile.getAbsolutePath());

        OrtEnvironment env = OrtEnvironment.getEnvironment();
        OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
        OrtSession session = env.createSession(modelFile.getAbsolutePath(), opts);

        OnnxModelMetadata metadata = session.getMetadata();
        System.out.println("Producer Name: " + metadata.getProducerName());
        System.out.println("Graph Name: " + metadata.getGraphName());
        System.out.println("Description: " + metadata.getDescription());
        System.out.println("Custom Metadata: " + metadata.getCustomMetadata());
        System.out.println("Input Info: " + session.getInputInfo());
        System.out.println("Output Info: " + session.getOutputInfo());

        session.close();
        env.close();
    }
}
